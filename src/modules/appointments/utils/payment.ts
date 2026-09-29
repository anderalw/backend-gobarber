import AppError from '@shared/errors/AppError';
import Appointment, {
  PaymentMethod,
} from '../infra/typeorm/entities/Appointment';
import { PaymentTotals } from '../infra/typeorm/entities/CashClosing';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'pix',
  'credit',
  'debit',
  'cash',
];

// Valor máximo de um atendimento (R$ 10.000,00): evita erros de digitação
export const MAX_PAID_CENTS = 1000000;

// O que entrou no caixa: o valor informado ou, sem ele, o preço marcado
export function receivedCents(appointment: Appointment): number {
  return appointment.paid_cents ?? appointment.price_cents ?? 0;
}

export function emptyTotals(): PaymentTotals {
  return {
    pix: { count: 0, cents: 0 },
    credit: { count: 0, cents: 0 },
    debit: { count: 0, cents: 0 },
    cash: { count: 0, cents: 0 },
    unknown: { count: 0, cents: 0 },
  };
}

// Soma os atendimentos concluídos por forma de pagamento
export function totalsByMethod(appointments: Appointment[]): PaymentTotals {
  const totals = emptyTotals();

  appointments.forEach(appointment => {
    const key = appointment.payment_method || 'unknown';

    totals[key].count += 1;
    totals[key].cents += receivedCents(appointment);
  });

  return totals;
}

export function validatePayment(
  payment_method: PaymentMethod | null | undefined,
  paid_cents: number | null | undefined,
): void {
  if (payment_method && !PAYMENT_METHODS.includes(payment_method)) {
    throw new AppError('Forma de pagamento inválida.');
  }

  if (
    paid_cents !== null &&
    paid_cents !== undefined &&
    (!Number.isInteger(paid_cents) ||
      paid_cents < 0 ||
      paid_cents > MAX_PAID_CENTS)
  ) {
    throw new AppError('Informe um valor recebido válido.');
  }
}
