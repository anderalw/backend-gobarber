import { injectable, inject } from 'tsyringe';
import { subDays } from 'date-fns';

import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import IMembershipsRepository from '../repositories/IMembershipsRepository';
import IMembershipPlansRepository from '../repositories/IMembershipPlansRepository';
import IMembershipPaymentsRepository from '../repositories/IMembershipPaymentsRepository';
import MembershipsService, { IMembershipView } from './MembershipsService';

// Janela dos números de rentabilidade e cancelamentos
const WINDOW_DAYS = 30;

interface IPlanNumbers {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
  subscribers: number;
  // Últimos 30 dias: mensalidades recebidas x quanto os usos valeriam no
  // preço normal
  received_cents: number;
  uses: number;
  used_value_cents: number;
}

interface IOverview {
  summary: {
    active: number;
    overdue: number;
    pending: number;
    // Soma das mensalidades das assinaturas em dia
    monthly_cents: number;
    canceled_last_30_days: number;
  };
  memberships: IMembershipView[];
  plans: IPlanNumbers[];
}

const ORDER = { pending: 0, overdue: 1, active: 2, canceled: 3 };

// Tela do clube: assinantes, pedidos e como cada plano está rendendo
@injectable()
class ClubOverviewService {
  constructor(
    @inject('MembershipsRepository')
    private membershipsRepository: IMembershipsRepository,

    @inject('MembershipPlansRepository')
    private plansRepository: IMembershipPlansRepository,

    @inject('MembershipPaymentsRepository')
    private paymentsRepository: IMembershipPaymentsRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject(MembershipsService)
    private membershipsService: MembershipsService,
  ) {}

  public async execute(): Promise<IOverview> {
    const now = new Date(Date.now());
    const since = subDays(now, WINDOW_DAYS);

    const [current, canceled, plans, payments, appointments] =
      await Promise.all([
        this.membershipsRepository.findByStatus(['pending', 'active']),
        this.membershipsRepository.findCanceledSince(since),
        this.plansRepository.findAll({ only_active: false }),
        this.paymentsRepository.findPaidInPeriod(since, now),
        this.appointmentsRepository.findAllInPeriod(since, now),
      ]);

    const views = current
      .map(membership => this.membershipsService.view(membership, now))
      .sort(
        (a, b) =>
          ORDER[a.state] - ORDER[b.state] ||
          (a.paid_until || '').localeCompare(b.paid_until || '') ||
          a.client.name.localeCompare(b.client.name),
      );

    // De qual plano é cada assinatura (inclusive as canceladas no período)
    const planOf = new Map(
      [...current, ...canceled].map(membership => [
        membership.id,
        membership.plan_id,
      ]),
    );
    const used = appointments.filter(
      appointment => appointment.membership_id && !appointment.canceled_at,
    );

    return {
      summary: {
        active: views.filter(item => item.state === 'active').length,
        overdue: views.filter(item => item.state === 'overdue').length,
        pending: views.filter(item => item.state === 'pending').length,
        monthly_cents: views
          .filter(item => item.state === 'active')
          .reduce((sum, item) => sum + item.plan.price_cents, 0),
        canceled_last_30_days: canceled.length,
      },
      memberships: views,
      plans: plans.map(plan => {
        const mine = used.filter(
          appointment =>
            planOf.get(appointment.membership_id as string) === plan.id,
        );

        return {
          id: plan.id,
          name: plan.name,
          price_cents: plan.price_cents,
          active: plan.active,
          subscribers: views.filter(
            item => item.plan.id === plan.id && item.state !== 'pending',
          ).length,
          received_cents: payments
            .filter(payment => payment.membership?.plan_id === plan.id)
            .reduce((sum, payment) => sum + payment.amount_cents, 0),
          uses: mine.length,
          used_value_cents: mine.reduce(
            (sum, appointment) => sum + (appointment.list_price_cents || 0),
            0,
          ),
        };
      }),
    };
  }
}

export default ClubOverviewService;
