import { injectable, inject } from 'tsyringe';
import { isBefore } from 'date-fns';

import AppError from '@shared/errors/AppError';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';

interface IRequest {
  appointment_id: string;
  // false desfaz uma confirmação feita pela barbearia
  confirmed: boolean;
  // Barbeiro logado (a agenda é compartilhada)
  requester_id: string;
}

// Confirmação registrada pela barbearia, para o cliente que confirmou por
// telefone ou WhatsApp em vez do link do e-mail. Só antes do horário
@injectable()
class SetConfirmationService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,
  ) {}

  public async execute({
    appointment_id,
    confirmed,
    requester_id,
  }: IRequest): Promise<Appointment> {
    const appointment = await this.appointmentsRepository.findById(
      appointment_id,
    );

    if (!appointment) {
      throw new AppError('Agendamento não encontrado.', 404);
    }

    if (appointment.canceled_at) {
      throw new AppError('Este agendamento foi cancelado.');
    }

    if (!isBefore(Date.now(), appointment.date)) {
      throw new AppError(
        'Este horário já começou. Registre a situação do atendimento.',
      );
    }

    if (confirmed && !appointment.confirmed_at) {
      await this.appointmentsRepository.markConfirmed(
        appointment_id,
        new Date(Date.now()),
        requester_id,
      );
    }

    if (!confirmed && appointment.confirmed_at) {
      // A confirmação do próprio cliente fica registrada
      if (!appointment.confirmed_by) {
        throw new AppError(
          'O cliente confirmou pelo link do e-mail; não é possível desfazer.',
        );
      }

      await this.appointmentsRepository.markConfirmed(
        appointment_id,
        null,
        null,
      );
    }

    return (await this.appointmentsRepository.findById(
      appointment_id,
    )) as Appointment;
  }
}

export default SetConfirmationService;
