import { injectable, inject } from 'tsyringe';
import { isBefore } from 'date-fns';

import AppError from '@shared/errors/AppError';
import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import { MAX_PAID_CENTS } from '@modules/appointments/utils/payment';
import CardCharge from '../infra/typeorm/entities/CardCharge';
import ICardChargesRepository from '../repositories/ICardChargesRepository';
import ITerminalDevicesRepository from '../repositories/ITerminalDevicesRepository';
import TerminalRegistry from '../providers/TerminalProvider/TerminalRegistry';
import { ITerminalChargeStatus } from '../providers/TerminalProvider/models/ITerminalProvider';
import TerminalSettingsService from './TerminalSettingsService';

interface IStartRequest {
  appointment_id: string;
  device_id: string;
  // Sem valor: o preço marcado
  amount_cents?: number | null;
  requester_id: string;
}

// Cobrança na maquininha: manda o valor para a maquininha escolhida e, quando
// a operadora aprova, marca o atendimento como concluído e pago (forma e valor
// vindos da maquininha)
@injectable()
class CardChargeService {
  constructor(
    @inject('CardChargesRepository')
    private chargesRepository: ICardChargesRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('TerminalDevicesRepository')
    private devicesRepository: ITerminalDevicesRepository,

    @inject(TerminalRegistry)
    private registry: TerminalRegistry,

    @inject(TerminalSettingsService)
    private terminalSettings: TerminalSettingsService,
  ) {}

  public async start({
    appointment_id,
    device_id,
    amount_cents,
    requester_id,
  }: IStartRequest): Promise<CardCharge> {
    const terminal = await this.terminalSettings.active();

    if (!terminal) {
      throw new AppError('A cobrança na maquininha não está configurada.');
    }

    const { provider, credentials } = terminal;

    const appointment = await this.appointmentsRepository.findById(
      appointment_id,
    );

    if (!appointment) {
      throw new AppError('Agendamento não encontrado.', 404);
    }

    if (appointment.canceled_at) {
      throw new AppError('Este agendamento foi cancelado.');
    }

    if (isBefore(Date.now(), appointment.date)) {
      throw new AppError('Só é possível cobrar depois que o horário começa.');
    }

    if (appointment.attendance === 'completed' && appointment.payment_method) {
      throw new AppError('Este atendimento já está pago.');
    }

    const amount = amount_cents ?? appointment.price_cents ?? 0;

    if (!Number.isInteger(amount) || amount < 100 || amount > MAX_PAID_CENTS) {
      throw new AppError('Informe um valor a partir de R$ 1,00.');
    }

    const device = await this.devicesRepository.findById(device_id);

    if (!device || !device.active || device.provider !== provider.key) {
      throw new AppError('Maquininha não encontrada.');
    }

    // Uma cobrança por vez para cada atendimento: a anterior sai da tela
    const previous = await this.chargesRepository.findPendingByAppointment(
      appointment_id,
    );

    if (previous) {
      await this.cancel(previous.id);
    }

    const charge = await this.chargesRepository.create({
      appointment_id,
      provider: provider.key,
      device_id: device.external_id,
      device_name: device.name,
      amount_cents: amount,
      created_by: requester_id,
    });

    try {
      const { external_id } = await provider.createCharge(credentials, {
        device_id: device.external_id,
        amount_cents: amount,
        description: [appointment.service?.name, appointment.client?.name]
          .filter(Boolean)
          .join(' - '),
        reference: charge.id,
      });

      charge.external_id = external_id;
    } catch (err) {
      charge.status = 'rejected';
      charge.message =
        err instanceof AppError
          ? err.message
          : 'A maquininha não respondeu. Tente de novo.';
      charge.resolved_at = new Date(Date.now());
    }

    return this.chargesRepository.save(charge);
  }

  // Situação atual (pergunta à operadora se ainda está aguardando)
  public async refresh(charge_id: string): Promise<CardCharge> {
    const charge = await this.find(charge_id);

    if (charge.status !== 'pending' || !charge.external_id) return charge;

    const provider = this.registry.get(charge.provider);

    if (!provider) return charge;

    const credentials = await this.terminalSettings.credentialsFor(
      provider.key,
    );

    return this.apply(
      charge,
      await provider.getStatus(credentials, charge.external_id),
    );
  }

  public async cancel(charge_id: string): Promise<CardCharge> {
    const charge = await this.find(charge_id);

    if (charge.status !== 'pending') return charge;

    const provider = this.registry.get(charge.provider);

    if (provider && charge.external_id) {
      const credentials = await this.terminalSettings.credentialsFor(
        provider.key,
      );

      // Pode ter sido paga no último instante: confere antes de cancelar
      const current = await provider.getStatus(credentials, charge.external_id);

      if (current.status !== 'pending') {
        return this.apply(charge, current);
      }

      await provider.cancel(credentials, charge.external_id);
    }

    return this.apply(charge, {
      status: 'canceled',
      message: 'Cobrança cancelada.',
    });
  }

  // Tarefa periódica: registra o que foi pago mesmo com a tela fechada
  public async refreshPending(): Promise<number> {
    const pending = await this.chargesRepository.findPending();
    let resolved = 0;

    // eslint-disable-next-line no-restricted-syntax
    for (const charge of pending) {
      // eslint-disable-next-line no-await-in-loop
      const updated = await this.refresh(charge.id);

      if (updated.status !== 'pending') resolved += 1;
    }

    return resolved;
  }

  private async find(charge_id: string): Promise<CardCharge> {
    const charge = await this.chargesRepository.findById(charge_id);

    if (!charge) {
      throw new AppError('Cobrança não encontrada.', 404);
    }

    return charge;
  }

  private async apply(
    charge: CardCharge,
    result: ITerminalChargeStatus,
  ): Promise<CardCharge> {
    if (result.status === 'pending') return charge;

    Object.assign(charge, {
      status: result.status,
      method: result.method || null,
      message: result.message || null,
      resolved_at: new Date(Date.now()),
    });

    if (result.status === 'approved') {
      const appointment = await this.appointmentsRepository.findById(
        charge.appointment_id,
      );
      const paid = result.paid_cents ?? charge.amount_cents;

      if (appointment) {
        await this.appointmentsRepository.setAttendance({
          appointment_id: appointment.id,
          attendance: 'completed',
          attendance_at: new Date(Date.now()),
          attendance_by: charge.created_by,
          payment_method: result.method || null,
          // Igual ao preço marcado: não precisa guardar o valor
          paid_cents: paid === appointment.price_cents ? null : paid,
        });
      }
    }

    return this.chargesRepository.save(charge);
  }
}

export default CardChargeService;
