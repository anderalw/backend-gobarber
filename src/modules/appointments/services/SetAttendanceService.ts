import { injectable, inject } from 'tsyringe';
import { isBefore } from 'date-fns';

import AppError from '@shared/errors/AppError';
import Appointment, {
  Attendance,
  PaymentMethod,
} from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import {
  applyMembershipChoice,
  isIncluded,
  validatePayment,
} from '../utils/payment';

interface IRequest {
  appointment_id: string;
  // null desfaz o registro
  attendance: Attendance | null;
  // Barbeiro logado (a agenda é compartilhada)
  requester_id: string;
  // Só com "atendido": como pagou e quanto (sem valor = o preço marcado)
  payment_method?: PaymentMethod | null;
  paid_cents?: number | null;
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
    payment_method = null,
    paid_cents = null,
  }: IRequest): Promise<Appointment> {
    validatePayment(payment_method, paid_cents);

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

    if (attendance === 'completed' && payment_method) {
      const wasIncluded = isIncluded(appointment);

      applyMembershipChoice(appointment, payment_method);

      // Cobrou normalmente: sai do plano ou pacote (o uso volta ao saldo)
      if (wasIncluded && !isIncluded(appointment)) {
        await this.appointmentsRepository.save(appointment);
      }
    }

    await this.appointmentsRepository.setAttendance({
      appointment_id,
      attendance,
      attendance_at: attendance ? new Date(Date.now()) : null,
      attendance_by: attendance ? requester_id : null,
      payment_method: attendance === 'completed' ? payment_method : null,
      // Incluso no plano: nada a receber
      paid_cents:
        attendance === 'completed' && payment_method !== 'membership'
          ? paid_cents
          : null,
    });

    return (await this.appointmentsRepository.findById(
      appointment_id,
    )) as Appointment;
  }
}

export default SetAttendanceService;
