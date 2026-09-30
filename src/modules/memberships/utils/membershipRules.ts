import {
  addDays,
  addMonths,
  differenceInCalendarMonths,
  format,
  isBefore,
  parseISO,
  startOfDay,
} from 'date-fns';

import Membership from '../infra/typeorm/entities/Membership';

// Dias depois do vencimento em que o plano ainda vale
export const GRACE_DAYS = 5;

// Situação vista pela barbearia e pelo cliente
export type MembershipState = 'pending' | 'active' | 'overdue' | 'canceled';

export const toDay = (date: Date): string => format(date, 'yyyy-MM-dd');

export function stateOf(membership: Membership, now: Date): MembershipState {
  if (membership.status !== 'active') return membership.status;

  if (!membership.paid_until) return 'overdue';

  const limit = addDays(parseISO(membership.paid_until), GRACE_DAYS);

  return isBefore(startOfDay(now), limit) ? 'active' : 'overdue';
}

// Ciclo mensal do saldo que contém a data: [start, end)
export function cycleFor(
  anchor: string,
  date: Date,
): { start: Date; end: Date } {
  const first = parseISO(anchor);
  let months = Math.max(0, differenceInCalendarMonths(date, first));
  let start = addMonths(first, months);

  // Ex.: âncora dia 20 e data dia 5 do mês seguinte: ainda no ciclo anterior
  if (isBefore(date, start) && months > 0) {
    months -= 1;
    start = addMonths(first, months);
  }

  return { start, end: addMonths(first, months + 1) };
}

// Preço com o desconto do plano, arredondado para o centavo
export function discounted(price_cents: number, percent: number): number {
  return Math.round((price_cents * (100 - percent)) / 100);
}
