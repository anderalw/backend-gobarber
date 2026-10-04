import { injectable, inject } from 'tsyringe';
import { addMonths, parseISO } from 'date-fns';

import AppError from '@shared/errors/AppError';
import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import { PaymentMethod } from '@modules/appointments/infra/typeorm/entities/Appointment';
import {
  MAX_PAID_CENTS,
  PAYMENT_METHODS,
} from '@modules/appointments/utils/payment';
import Membership from '../infra/typeorm/entities/Membership';
import IMembershipsRepository from '../repositories/IMembershipsRepository';
import IMembershipPlansRepository from '../repositories/IMembershipPlansRepository';
import IMembershipPaymentsRepository from '../repositories/IMembershipPaymentsRepository';
import {
  MembershipState,
  cycleFor,
  stateOf,
  toDay,
} from '../utils/membershipRules';

interface IPayment {
  payment_method: PaymentMethod;
  // Sem valor: a mensalidade do plano
  amount_cents?: number | null;
  user_id: string;
}

export interface IMembershipView {
  id: string;
  client: { id: string; name: string };
  plan: { id: string; name: string; price_cents: number };
  status: Membership['status'];
  state: MembershipState;
  paid_until: string | null;
  requested_at: Date | null;
  started_at: Date | null;
  canceled_at: Date | null;
}

export interface IMembershipDetails extends IMembershipView {
  // Saldo do ciclo atual: usados ou já agendados
  cycle: { start: string; end: string } | null;
  usage: Array<{
    service_id: string;
    service_name: string;
    quantity: number | null;
    used: number;
  }>;
  payments: Array<{
    id: string;
    amount_cents: number;
    payment_method: PaymentMethod;
    period_start: string;
    period_end: string;
    paid_at: Date;
  }>;
}

// Assinaturas do clube: adesão, mensalidades e cancelamento
@injectable()
class MembershipsService {
  constructor(
    @inject('MembershipsRepository')
    private membershipsRepository: IMembershipsRepository,

    @inject('MembershipPlansRepository')
    private plansRepository: IMembershipPlansRepository,

    @inject('MembershipPaymentsRepository')
    private paymentsRepository: IMembershipPaymentsRepository,

    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,
  ) {}

  // Na barbearia: assina e recebe a primeira mensalidade
  public async subscribe({
    client_id,
    plan_id,
    ...payment
  }: IPayment & { client_id: string; plan_id: string }): Promise<Membership> {
    const client = await this.clientsRepository.findById(client_id);

    if (!client) {
      throw new AppError('Cliente não encontrado.', 404);
    }

    await this.ensureNoCurrent(client_id);
    await this.activePlan(plan_id);
    this.validatePayment(payment);

    const membership = await this.membershipsRepository.create({
      client_id,
      plan_id,
      status: 'active',
      started_at: new Date(Date.now()),
      created_by: payment.user_id,
    });

    return this.pay(membership, payment);
  }

  // Pelo site: o cliente pede, a barbearia confirma ao receber
  public async request(
    client_id: string,
    plan_id: string,
  ): Promise<Membership> {
    await this.ensureNoCurrent(client_id);
    await this.activePlan(plan_id);

    return this.membershipsRepository.create({
      client_id,
      plan_id,
      status: 'pending',
      requested_at: new Date(Date.now()),
    });
  }

  public async confirm(id: string, payment: IPayment): Promise<Membership> {
    const membership = await this.find(id);

    if (membership.status !== 'pending') {
      throw new AppError('Este pedido já foi respondido.');
    }

    this.validatePayment(payment);

    Object.assign(membership, {
      status: 'active',
      started_at: new Date(Date.now()),
      created_by: payment.user_id,
    });

    return this.pay(membership, payment);
  }

  // Mensalidade: estende o "pago até" em um mês. Em atraso, recomeça hoje
  public async registerPayment(
    id: string,
    payment: IPayment,
  ): Promise<Membership> {
    const membership = await this.find(id);

    if (membership.status !== 'active') {
      throw new AppError('Esta assinatura não está ativa.');
    }

    this.validatePayment(payment);

    return this.pay(membership, payment);
  }

  // Cancela (ou recusa o pedido). Os próximos agendamentos inclusos voltam
  // ao preço normal
  public async cancel(id: string): Promise<Membership> {
    const membership = await this.find(id);

    if (membership.status === 'canceled') return membership;

    const now = new Date(Date.now());

    membership.status = 'canceled';
    membership.canceled_at = now;

    const upcoming = await this.appointmentsRepository.findByMembershipInPeriod(
      membership.id,
      now,
      addMonths(now, 24),
    );

    await Promise.all(
      upcoming
        .filter(appointment => !appointment.attendance)
        .map(appointment =>
          this.appointmentsRepository.save(
            Object.assign(appointment, {
              membership_id: null,
              price_cents: appointment.list_price_cents,
              list_price_cents: null,
            }),
          ),
        ),
    );

    return this.membershipsRepository.save(membership);
  }

  // Assinatura atual do cliente (pedida ou ativa), com saldo e mensalidades
  public async forClient(
    client_id: string,
  ): Promise<IMembershipDetails | null> {
    const membership = await this.membershipsRepository.findCurrentByClient(
      client_id,
    );

    return membership ? this.details(membership) : null;
  }

  public async details(membership: Membership): Promise<IMembershipDetails> {
    const now = new Date(Date.now());
    const anchor = membership.cycle_anchor;
    const cycle = anchor ? cycleFor(anchor, now) : null;
    const booked = cycle
      ? await this.appointmentsRepository.findByMembershipInPeriod(
          membership.id,
          cycle.start,
          cycle.end,
        )
      : [];
    const payments = await this.paymentsRepository.findByMembership(
      membership.id,
    );
    const services = await this.servicesRepository.findAll({
      only_active: false,
    });

    return {
      ...this.view(membership, now),
      cycle: cycle
        ? { start: toDay(cycle.start), end: toDay(cycle.end) }
        : null,
      usage: (membership.plan?.items || []).map(item => ({
        service_id: item.service_id,
        service_name:
          services.find(service => service.id === item.service_id)?.name ||
          'Serviço removido',
        quantity: item.quantity,
        used: booked.filter(
          appointment => appointment.service_id === item.service_id,
        ).length,
      })),
      payments: payments.map(payment => ({
        id: payment.id,
        amount_cents: payment.amount_cents,
        payment_method: payment.payment_method,
        period_start: payment.period_start,
        period_end: payment.period_end,
        paid_at: payment.paid_at,
      })),
    };
  }

  public view(membership: Membership, now: Date): IMembershipView {
    return {
      id: membership.id,
      client: {
        id: membership.client_id,
        name: membership.client?.name || 'Cliente removido',
      },
      plan: {
        id: membership.plan_id,
        name: membership.plan?.name || 'Plano removido',
        price_cents: membership.plan?.price_cents || 0,
      },
      status: membership.status,
      state: stateOf(membership, now),
      paid_until: membership.paid_until,
      requested_at: membership.requested_at,
      started_at: membership.started_at,
      canceled_at: membership.canceled_at,
    };
  }

  public async find(id: string): Promise<Membership> {
    const membership = await this.membershipsRepository.findById(id);

    if (!membership) {
      throw new AppError('Assinatura não encontrada.', 404);
    }

    return membership;
  }

  private async pay(
    membership: Membership,
    { payment_method, amount_cents, user_id }: IPayment,
  ): Promise<Membership> {
    const now = new Date(Date.now());
    const today = toDay(now);
    const lapsed =
      !membership.paid_until || stateOf(membership, now) === 'overdue';
    // Em dia: emenda no mês seguinte; em atraso (ou o primeiro): a partir de hoje
    const start = lapsed ? today : (membership.paid_until as string);
    const end = toDay(addMonths(parseISO(start), 1));

    await this.paymentsRepository.create({
      membership_id: membership.id,
      amount_cents: amount_cents ?? membership.plan?.price_cents ?? 0,
      payment_method,
      period_start: start,
      period_end: end,
      paid_at: now,
      received_by: user_id,
    });

    Object.assign(membership, {
      paid_until: end,
      // O saldo recomeça quando a assinatura (re)começa
      cycle_anchor: lapsed ? start : membership.cycle_anchor,
    });

    await this.membershipsRepository.save(membership);

    return (await this.membershipsRepository.findById(
      membership.id,
    )) as Membership;
  }

  private validatePayment({ payment_method, amount_cents }: IPayment): void {
    if (!PAYMENT_METHODS.includes(payment_method)) {
      throw new AppError('Forma de pagamento inválida.');
    }

    if (
      amount_cents !== null &&
      amount_cents !== undefined &&
      (!Number.isInteger(amount_cents) ||
        amount_cents < 0 ||
        amount_cents > MAX_PAID_CENTS)
    ) {
      throw new AppError('Informe um valor válido.');
    }
  }

  private async ensureNoCurrent(client_id: string): Promise<void> {
    const current = await this.membershipsRepository.findCurrentByClient(
      client_id,
    );

    if (current) {
      throw new AppError(
        current.status === 'pending'
          ? 'Já existe um pedido de assinatura aguardando confirmação.'
          : 'Este cliente já tem uma assinatura ativa.',
      );
    }
  }

  private async activePlan(plan_id: string): Promise<void> {
    const plan = await this.plansRepository.findById(plan_id);

    if (!plan || !plan.active) {
      throw new AppError('Plano não disponível.');
    }
  }
}

export default MembershipsService;
