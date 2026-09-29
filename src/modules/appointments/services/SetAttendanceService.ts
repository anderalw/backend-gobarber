import { injectable, inject } from 'tsyringe';
import { isBefore } from 'date-fns';

import AppError from '@shared/errors/AppError';
import Appointment, { Attendance } from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';

interface IRequest {
  appointment_id: string;
  // null desfaz o registro
  attendance: Attendance | null;
  // Barbeiro logado (a agenda é compartilhada)
  requester_id: string;
}

// Registra como terminou o atendimento: concluído (entra no faturamento) ou
// falta do cliente. Só depois que o horário começa, e pode ser corrigido
@injectable()
class SetAttendanceService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,
  ) {}

  public async execute({
    appointment_id,
    attendance,
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

    if (isBefore(Date.now(), appointment.date)) {
      throw new AppError(
        'Só é possível registrar a situação depois que o horário começa.',
      );
    }

    await this.appointmentsRepository.setAttendance({
      appointment_id,
      attendance,
      attendance_at: attendance ? new Date(Date.now()) : null,
      attendance_by: attendance ? requester_id : null,
    });

    return (await this.appointmentsRepository.findById(
      appointment_id,
    )) as Appointment;
  }
}

export default SetAttendanceService;
