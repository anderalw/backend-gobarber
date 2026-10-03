import { injectable, inject } from 'tsyringe';
import { isBefore } from 'date-fns';

import AppError from '@shared/errors/AppError';
import {
  Attendance,
  PaymentMethod,
} from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import SetAttendanceService from './SetAttendanceService';

interface IItem {
  id: string;
  attendance: Attendance;
  // Só com "atendido"
  payment_method?: PaymentMethod | null;
  paid_cents?: number | null;
}

interface IRequest {
  items: IItem[];
  requester_id: string;
}

// Fechar o dia pelo caixa: registra de uma vez se cada cliente foi atendido
// (com a forma de pagamento) ou faltou. Confere todos antes de gravar, para
// não ficar pela metade
@injectable()
class RegisterAttendancesService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,
  ) {}

  public async execute({ items, requester_id }: IRequest): Promise<number> {
    if (new Set(items.map(item => item.id)).size !== items.length) {
      throw new AppError('Há atendimentos repetidos na lista.');
    }

    const now = Date.now();

    await Promise.all(
      items.map(async item => {
        const appointment = await this.appointmentsRepository.findById(item.id);

        if (!appointment) {
          throw new AppError('Agendamento não encontrado.', 404);
        }

        if (appointment.canceled_at) {
          throw new AppError(
            `O agendamento de ${
              appointment.client?.name || 'um cliente'
            } foi cancelado.`,
          );
        }

        if (isBefore(now, appointment.date)) {
          throw new AppError(
            'Só é possível registrar a situação depois que o horário começa.',
          );
        }

        if (
          item.payment_method === 'membership' &&
          !appointment.membership_id
        ) {
          throw new AppError(
            `O atendimento de ${
              appointment.client?.name || 'um cliente'
            } não está incluso em um plano.`,
          );
        }
      }),
    );

    const setAttendance = new SetAttendanceService(this.appointmentsRepository);

    // Um de cada vez: o clube mexe no saldo do plano
    // eslint-disable-next-line no-restricted-syntax
    for (const item of items) {
      // eslint-disable-next-line no-await-in-loop
      await setAttendance.execute({
        appointment_id: item.id,
        attendance: item.attendance,
        requester_id,
        payment_method:
          item.attendance === 'completed' ? item.payment_method ?? null : null,
        paid_cents:
          item.attendance === 'completed' ? item.paid_cents ?? null : null,
      });
    }

    return items.length;
  }
}

export default RegisterAttendancesService;
