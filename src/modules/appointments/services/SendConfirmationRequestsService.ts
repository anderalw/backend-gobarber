import { injectable, inject } from 'tsyringe';
import { randomBytes } from 'crypto';
import { addHours, differenceInHours } from 'date-fns';

import { webUrl } from '@shared/tenancy/hosts';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import IClientNotifier from '../notifier/IClientNotifier';

// Com quanta antecedência o pedido de confirmação é enviado
export const CONFIRMATION_WINDOW_HOURS = 24;
// Marcado em cima da hora (menos que isso antes do horário), o cliente acabou
// de receber o aviso de agendamento: não pede confirmação
export const MIN_NOTICE_HOURS = 12;

// Tarefa periódica: na véspera, pede ao cliente para confirmar a presença
// por um link. Cada agendamento recebe um pedido só; remarcar gera outro
@injectable()
class SendConfirmationRequestsService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('ClientNotifier')
    private clientNotifier: IClientNotifier,
  ) {}

  // Quantos pedidos foram enviados
  public async execute(): Promise<number> {
    const now = new Date(Date.now());
    const due =
      await this.appointmentsRepository.findAwaitingConfirmationRequest(
        now,
        addHours(now, CONFIRMATION_WINDOW_HOURS),
      );

    const sent = await Promise.all(
      due.map(async appointment => {
        const bookedAhead = differenceInHours(
          appointment.date,
          appointment.created_at,
        );

        // Sem canal que alcance o cliente (e-mail ou WhatsApp), não pede
        if (
          !appointment.client ||
          bookedAhead < MIN_NOTICE_HOURS ||
          !(await this.clientNotifier.reaches(appointment.client))
        ) {
          return false;
        }

        const token = randomBytes(24).toString('hex');
        const marked =
          await this.appointmentsRepository.markConfirmationRequested(
            appointment.id,
            token,
            now,
          );

        // Outra execução já enviou
        if (!marked) return false;

        await this.clientNotifier.confirmationRequested(
          appointment,
          `${webUrl()}/confirmar-agendamento?token=${token}`,
        );

        return true;
      }),
    );

    return sent.filter(Boolean).length;
  }
}

export default SendConfirmationRequestsService;
