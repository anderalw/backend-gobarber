import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import Appointment, {
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
  payment_method: PaymentMethod | null;
  // Sem valor = o preço marcado
  paid_cents?: number | null;
}

// Completa ou corrige o pagamento de um atendimento já concluído (ex: pela
// tela do caixa, antes de fechar)
@injectable()
class SetPaymentService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,
  ) {}

  public async execute({
    appointment_id,
    payment_method,
    paid_cents = null,
  }: IRequest): Promise<Appointment> {
    validatePayment(payment_method, paid_cents);

    const appointment = await this.appointmentsRepository.findById(
      appointment_id,
    );

    if (!appointment) {
      throw new AppError('Agendamento não encontrado.', 404);
    }

    if (appointment.canceled_at || appointment.attendance !== 'completed') {
      throw new AppError(
        'O pagamento só é registrado em atendimentos concluídos.',
      );
    }

    const wasIncluded = isIncluded(appointment);

    applyMembershipChoice(appointment, payment_method);

    // Cobrou normalmente: sai do plano ou pacote (o uso volta ao saldo)
    if (wasIncluded && !isIncluded(appointment)) {
      await this.appointmentsRepository.save(appointment);
    }

    await this.appointmentsRepository.setAttendance({
      appointment_id,
      attendance: appointment.attendance,
      attendance_at: appointment.attendance_at,
      attendance_by: appointment.attendance_by,
      payment_method,
      paid_cents: payment_method === 'membership' ? null : paid_cents,
    });

    return (await this.appointmentsRepository.findById(
      appointment_id,
    )) as Appointment;
  }
}

export default SetPaymentService;
