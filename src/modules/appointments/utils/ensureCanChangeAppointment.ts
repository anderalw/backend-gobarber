import { addHours, isBefore } from 'date-fns';

import AppError from '@shared/errors/AppError';
import Appointment from '../infra/typeorm/entities/Appointment';

// Antecedência mínima para o cliente cancelar ou remarcar sozinho; depois
// disso, só a barbearia pode alterar
export const CLIENT_CHANGE_NOTICE_HOURS = 2;

export interface IRequester {
  id: string;
  role: 'provider' | 'client';
}

// O cliente só pode alterar os próprios agendamentos, com antecedência
export function clientCanChange(appointment: Appointment, now: Date): boolean {
  return isBefore(addHours(now, CLIENT_CHANGE_NOTICE_HOURS), appointment.date);
}

// Regras comuns a cancelar e remarcar
export default function ensureCanChangeAppointment(
  appointment: Appointment | undefined,
  requester: IRequester,
  now: Date,
): Appointment {
  // Para o cliente, agendamento de outra pessoa é tratado como inexistente
  if (
    !appointment ||
    (requester.role === 'client' && appointment.client_id !== requester.id)
  ) {
    throw new AppError('Agendamento não encontrado.', 404);
  }

  if (appointment.canceled_at) {
    throw new AppError('Este agendamento já foi cancelado.');
  }

  if (!isBefore(now, appointment.date)) {
    throw new AppError(
      'Não é possível alterar um agendamento que já começou ou já passou.',
    );
  }

  if (requester.role === 'client' && !clientCanChange(appointment, now)) {
    throw new AppError(
      `Alterações pelo cliente só com ${CLIENT_CHANGE_NOTICE_HOURS} horas de antecedência. Entre em contato com a equipe.`,
    );
  }

  return appointment;
}
