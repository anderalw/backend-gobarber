import { injectable, inject } from 'tsyringe';
import { addDays, differenceInCalendarDays, subDays } from 'date-fns';

import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import IMembershipsRepository from '../repositories/IMembershipsRepository';
import { cycleFor, discounted, stateOf } from '../utils/membershipRules';

interface IRequest {
  client_id: string;
  service_id: string;
  // Preço normal do serviço
  price_cents: number;
  date: Date;
  // Remarcação: o próprio agendamento não conta no saldo
  except_appointment_id?: string;
}

export interface IBenefit {
  // Preenchido quando o serviço fica incluso no plano (preço 0)
  membership_id: string | null;
  price_cents: number;
  // Preço normal, quando houve benefício (incluso ou desconto)
  list_price_cents: number | null;
  plan_name: string | null;
  // Por que não ficou incluso (fora do plano, saldo usado...)
  reason: string | null;
}

const WEEKDAYS = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];

// Clube: decide se um agendamento fica incluso no plano do cliente, com
// desconto, ou no preço normal (e o motivo, para a tela explicar)
@injectable()
class MembershipBenefitService {
  constructor(
    @inject('MembershipsRepository')
    private membershipsRepository: IMembershipsRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,
  ) {}

  public async evaluate({
    client_id,
    service_id,
    price_cents,
    date,
    except_appointment_id,
  }: IRequest): Promise<IBenefit> {
    const normal: IBenefit = {
      membership_id: null,
      price_cents,
      list_price_cents: null,
      plan_name: null,
      reason: null,
    };

    const membership = await this.membershipsRepository.findCurrentByClient(
      client_id,
    );

    if (!membership || membership.status !== 'active' || !membership.plan) {
      return normal;
    }

    const { plan } = membership;
    const planName = plan.name;

    if (stateOf(membership, new Date(Date.now())) === 'overdue') {
      return {
        ...normal,
        plan_name: planName,
        reason: 'Mensalidade do plano em atraso.',
      };
    }

    // Fora das regras: preço normal, com o desconto do plano (se houver)
    const outside = (reason: string): IBenefit =>
      plan.discount_percent > 0 && price_cents > 0
        ? {
            membership_id: null,
            price_cents: discounted(price_cents, plan.discount_percent),
            list_price_cents: price_cents,
            plan_name: planName,
            reason: `${reason} Desconto de ${plan.discount_percent}% do plano.`,
          }
        : { ...normal, plan_name: planName, reason };

    const item = plan.items.find(entry => entry.service_id === service_id);

    if (!item) return outside('Serviço fora do plano.');

    if (plan.weekdays && !plan.weekdays.includes(date.getDay())) {
      return outside(`O plano não vale ${WEEKDAYS[date.getDay()]}.`);
    }

    const sameService = (from: Date, to: Date) =>
      this.appointmentsRepository
        .findByMembershipInPeriod(membership.id, from, to)
        .then(list =>
          list.filter(
            appointment =>
              appointment.service_id === service_id &&
              appointment.id !== except_appointment_id,
          ),
        );

    if (plan.min_interval_days) {
      const days = plan.min_interval_days;
      const near = (
        await sameService(subDays(date, days), addDays(date, days))
      ).filter(
        appointment =>
          Math.abs(differenceInCalendarDays(appointment.date, date)) < days,
      );

      if (near.length > 0) {
        return outside(`Intervalo mínimo de ${days} dias entre usos.`);
      }
    }

    if (item.quantity !== null) {
      const cycle = cycleFor(
        membership.cycle_anchor || membership.paid_until || '',
        date,
      );
      const used = (await sameService(cycle.start, cycle.end)).length;

      if (used >= item.quantity) {
        return outside(`Saldo do mês usado (${used} de ${item.quantity}).`);
      }
    }

    return {
      membership_id: membership.id,
      price_cents: 0,
      list_price_cents: price_cents,
      plan_name: planName,
      reason: null,
    };
  }
}

export default MembershipBenefitService;
