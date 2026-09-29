import { injectable, inject } from 'tsyringe';
import { format, isBefore } from 'date-fns';

import AppError from '@shared/errors/AppError';
import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';

interface IResponse {
  // false: já estava confirmado (o link foi aberto de novo)
  confirmed_now: boolean;
  appointment: {
    date: Date;
    end_date: Date;
    client_name: string;
    provider_name: string;
    service_name: string;
  };
}

// O cliente abriu o link do e-mail da véspera: o agendamento fica
// confirmado e o barbeiro é avisado. Não precisa de login (o link é secreto)
@injectable()
class ConfirmAppointmentService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('NotificationsRepository')
    private notificationsRepository: INotificationsRepository,
  ) {}

  public async execute(token: string): Promise<IResponse> {
    const appointment =
      await this.appointmentsRepository.findByConfirmationToken(token);

    if (!appointment) {
      throw new AppError(
        'Link de confirmação inválido. Se o horário foi remarcado, use o link do e-mail mais recente.',
        404,
      );
    }

    if (appointment.canceled_at) {
      throw new AppError('Este agendamento foi cancelado.');
    }

    if (!isBefore(Date.now(), appointment.date)) {
      throw new AppError('Este horário já passou.');
    }

    const confirmedNow = !appointment.confirmed_at;

    if (confirmedNow) {
      await this.appointmentsRepository.markConfirmed(
        appointment.id,
        new Date(Date.now()),
      );

      await this.notificationsRepository.create({
        recipient_id: appointment.provider_id,
        content: `${
          appointment.client?.name || 'O cliente'
        } confirmou o agendamento de ${
          appointment.service?.name || 'serviço'
        } em ${format(appointment.date, "dd/MM/yyyy 'às' HH:mm")}`,
        date: appointment.date,
      });
    }

    return {
      confirmed_now: confirmedNow,
      appointment: {
        date: appointment.date,
        end_date: appointment.end_date,
        client_name: appointment.client?.name || '',
        provider_name: appointment.provider?.name || '',
        service_name: appointment.service?.name || 'Atendimento',
      },
    };
  }
}

export default ConfirmAppointmentService;
