import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';
import Appointment, {
  PaymentMethod,
} from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import { PAYMENT_METHODS } from '../utils/payment';

const KEY = 'deposit_instructions';

interface IReceiveRequest {
  appointment_id: string;
  // null desfaz o registro
  payment_method: PaymentMethod | null;
  // Outro valor combinado com o cliente (omitido = o sinal pedido)
  amount_cents?: number | null;
  user_id: string;
}

// Sinal para garantir o horário: a orientação de como pagar e o registro do
// recebimento (entra no caixa do dia em que foi recebido)
@injectable()
class DepositService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,
  ) {}

  public async instructions(): Promise<string> {
    return (await this.settingsRepository.get(KEY)) || '';
  }

  public async setInstructions(text: string): Promise<string> {
    await this.settingsRepository.set(KEY, text.trim());

    return this.instructions();
  }

  public async receive({
    appointment_id,
    payment_method,
    amount_cents,
    user_id,
  }: IReceiveRequest): Promise<Appointment> {
    const appointment = await this.appointmentsRepository.findById(
      appointment_id,
    );

    if (!appointment) {
      throw new AppError('Agendamento não encontrado.', 404);
    }

    if (payment_method === null) {
      if (appointment.attendance === 'completed') {
        throw new AppError(
          'O atendimento já foi concluído: corrija o pagamento pelo caixa.',
        );
      }

      Object.assign(appointment, {
        deposit_paid_at: null,
        deposit_method: null,
        deposit_received_by: null,
      });

      return this.appointmentsRepository.save(appointment);
    }

    if (!PAYMENT_METHODS.includes(payment_method)) {
      throw new AppError('Forma de pagamento inválida.');
    }

    if (appointment.canceled_at) {
      throw new AppError('Este agendamento foi cancelado.');
    }

    if (appointment.attendance) {
      throw new AppError('O atendimento já foi registrado.');
    }

    const price = appointment.price_cents || 0;
    const amount = amount_cents ?? appointment.deposit_cents;

    if (!amount || !Number.isInteger(amount) || amount <= 0 || amount > price) {
      throw new AppError('O sinal deve ser maior que zero e até o valor.');
    }

    Object.assign(appointment, {
      deposit_cents: amount,
      deposit_paid_at: new Date(Date.now()),
      deposit_method: payment_method,
      deposit_received_by: user_id,
    });

    return this.appointmentsRepository.save(appointment);
  }
}

export default DepositService;
