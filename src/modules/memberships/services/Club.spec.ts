import AppError from '@shared/errors/AppError';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeNotificationsRepository from '@modules/notifications/repositories/fakes/FakeNotificationsRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeServicesRepository from '@modules/catalog/repositories/fakes/FakeServicesRepository';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import Service from '@modules/catalog/infra/typeorm/entities/Service';
import FakeClientsRepository from '@modules/clients/repositories/fakes/FakeClientsRepository';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import FakeAppointmentsRepository from '@modules/appointments/repositories/fakes/FakeAppointmentsRepository';
import FakeTimeBlocksRepository from '@modules/appointments/repositories/fakes/FakeTimeBlocksRepository';
import FakeCashClosingsRepository from '@modules/appointments/repositories/fakes/FakeCashClosingsRepository';
import FakeClientNotifier from '@modules/appointments/notifier/FakeClientNotifier';
import CreateAppointmentsService from '@modules/appointments/services/CreateAppointmentsService';
import SetAttendanceService from '@modules/appointments/services/SetAttendanceService';
import CashRegisterService from '@modules/appointments/services/CashRegisterService';
import FakeMembershipPlansRepository from '../repositories/fakes/FakeMembershipPlansRepository';
import FakeMembershipsRepository from '../repositories/fakes/FakeMembershipsRepository';
import FakeMembershipPaymentsRepository from '../repositories/fakes/FakeMembershipPaymentsRepository';
import MembershipPlansService from './MembershipPlansService';
import MembershipsService from './MembershipsService';
import MembershipBenefitService from './MembershipBenefitService';
import ClubOverviewService from './ClubOverviewService';
import { IPlanData } from '../repositories/IMembershipPlansRepository';

let appointments: FakeAppointmentsRepository;
let paymentsRepository: FakeMembershipPaymentsRepository;
let plans: MembershipPlansService;
let memberships: MembershipsService;
let createAppointment: CreateAppointmentsService;
let setAttendance: SetAttendanceService;
let cash: CashRegisterService;
let overview: ClubOverviewService;
let haircut: Service;
let beard: Service;
let brow: Service;
let clientId: string;
let now: Date;

// "Agora" começa na segunda-feira, 05/10/2026 às 8h
const at = (day: number, hours = 10, month = 9): Date =>
  new Date(2026, month, day, hours);

function planData(data: Partial<IPlanData> = {}): IPlanData {
  return {
    name: 'Corte + Barba',
    description: null,
    price_cents: 12900,
    items: [
      { service_id: haircut.id, quantity: null },
      { service_id: beard.id, quantity: 2 },
    ],
    min_interval_days: null,
    weekdays: null,
    discount_percent: 10,
    active: true,
    ...data,
  };
}

async function book(serviceId: string, date: Date) {
  return createAppointment.execute({
    date,
    provider_id: 'provider-id',
    client_id: clientId,
    service_id: serviceId,
  });
}

async function subscribe(data: Partial<IPlanData> = {}) {
  const plan = await plans.create(planData(data));

  return memberships.subscribe({
    client_id: clientId,
    plan_id: plan.id,
    payment_method: 'pix',
    user_id: 'provider-id',
  });
}

describe('Clube de assinatura', () => {
  beforeEach(async () => {
    appointments = new FakeAppointmentsRepository();
    const services = new FakeServicesRepository();
    const clients = new FakeClientsRepository();
    const users = new FakeUsersRepository();
    const schedules = new FakeProviderSchedulesRepository();
    const plansRepository = new FakeMembershipPlansRepository();
    const membershipsRepository = new FakeMembershipsRepository(
      plansRepository,
    );

    paymentsRepository = new FakeMembershipPaymentsRepository(
      membershipsRepository,
    );
    plans = new MembershipPlansService(plansRepository, services);
    memberships = new MembershipsService(
      membershipsRepository,
      plansRepository,
      paymentsRepository,
      clients,
      appointments,
      services,
    );
    createAppointment = new CreateAppointmentsService(
      appointments,
      new FakeNotificationsRepository(),
      new FakeCacheProvider(),
      schedules,
      services,
      new AgendaSettingsService(new FakeSettingsRepository()),
      users,
      new FakeTimeBlocksRepository(),
      new FakeClientNotifier(),
      new MembershipBenefitService(membershipsRepository, appointments),
    );
    setAttendance = new SetAttendanceService(appointments);
    cash = new CashRegisterService(
      appointments,
      new FakeCashClosingsRepository(),
      users,
      paymentsRepository,
    );
    overview = new ClubOverviewService(
      membershipsRepository,
      plansRepository,
      paymentsRepository,
      appointments,
      memberships,
    );

    const provider = await users.create({
      name: 'Barbeiro',
      email: 'barbeiro@example.test',
      password: '123456',
    });
    provider.id = 'provider-id';

    await schedules.replaceByProviderId(
      'provider-id',
      [0, 1, 2, 3, 4, 5, 6].map(day_of_week => ({
        day_of_week,
        start_time: '08:00',
        end_time: '20:00',
      })),
    );

    haircut = await services.create({
      name: 'Corte',
      duration_minutes: 30,
      price_cents: 5000,
    });
    beard = await services.create({
      name: 'Barba',
      duration_minutes: 30,
      price_cents: 3000,
    });
    brow = await services.create({
      name: 'Sobrancelha',
      duration_minutes: 30,
      price_cents: 2000,
    });

    clientId = (
      await clients.create({
        name: 'Maria',
        email: null,
        password: null,
        phone: '11999990000',
      })
    ).id;

    now = at(5, 8);
    jest.spyOn(Date, 'now').mockImplementation(() => now.getTime());
  });

  it('should validate the plan', async () => {
    await expect(plans.create(planData({ items: [] }))).rejects.toMatchObject({
      message: 'Inclua pelo menos um serviço no plano.',
    });
    await expect(
      plans.create(
        planData({
          items: [
            { service_id: haircut.id, quantity: 1 },
            { service_id: haircut.id, quantity: 2 },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(AppError);

    const plan = await plans.create(
      planData({ weekdays: [0, 1, 2, 3, 4, 5, 6] }),
    );

    expect(plan).toMatchObject({
      // Todos os dias = sem restrição
      weekdays: null,
      items: [
        { service_name: 'Corte', quantity: null },
        { service_name: 'Barba', quantity: 2 },
      ],
    });
  });

  it('should include services in the plan up to the monthly balance', async () => {
    const membership = await subscribe();

    expect(membership).toMatchObject({
      status: 'active',
      cycle_anchor: '2026-10-05',
      paid_until: '2026-11-05',
    });

    // Corte ilimitado; barba 2 por mês; sobrancelha fora (10% de desconto)
    expect(await book(haircut.id, at(6))).toMatchObject({
      price_cents: 0,
      membership_id: membership.id,
      list_price_cents: 5000,
    });
    expect((await book(haircut.id, at(7))).price_cents).toBe(0);
    await book(beard.id, at(6, 11));
    const secondBeard = await book(beard.id, at(8, 11));
    const thirdBeard = await book(beard.id, at(9, 11));

    expect(secondBeard.price_cents).toBe(0);
    expect(thirdBeard).toMatchObject({
      membership_id: null,
      price_cents: 2700,
      list_price_cents: 3000,
    });
    expect((await book(brow.id, at(6, 12))).price_cents).toBe(1800);

    // Cancelar devolve o uso ao saldo
    Object.assign(secondBeard, { canceled_at: now });
    expect((await book(beard.id, at(10, 11))).price_cents).toBe(0);

    // O saldo renova no ciclo seguinte (a partir de 05/11)
    expect((await book(beard.id, at(5, 11, 10))).price_cents).toBe(0);

    const details = await memberships.forClient(clientId);

    expect(details?.usage).toEqual([
      expect.objectContaining({ service_name: 'Corte', used: 2 }),
      expect.objectContaining({ service_name: 'Barba', quantity: 2, used: 2 }),
    ]);
  });

  it('should respect weekdays and the minimum interval', async () => {
    // Segunda a quinta, um corte a cada 7 dias
    await subscribe({ weekdays: [1, 2, 3, 4], min_interval_days: 7 });

    // Sábado: fora dos dias do plano
    expect((await book(haircut.id, at(10))).price_cents).toBe(4500);
    expect((await book(haircut.id, at(6))).price_cents).toBe(0);
    // Só 2 dias depois
    expect((await book(haircut.id, at(8))).price_cents).toBe(4500);
    expect((await book(haircut.id, at(13))).price_cents).toBe(0);
  });

  it('should suspend the benefits when the payment is late', async () => {
    const membership = await subscribe();

    // Venceu em 05/11; tolerância de 5 dias
    now = at(9, 8, 10);
    expect((await book(haircut.id, at(9, 10, 10))).price_cents).toBe(0);

    now = at(10, 8, 10);
    expect(await memberships.forClient(clientId)).toMatchObject({
      state: 'overdue',
    });
    expect((await book(haircut.id, at(10, 11, 10))).price_cents).toBe(5000);

    // Pagou atrasado: o mês e o saldo recomeçam no dia do pagamento
    const renewed = await memberships.registerPayment(membership.id, {
      payment_method: 'cash',
      user_id: 'provider-id',
    });

    expect(renewed).toMatchObject({
      cycle_anchor: '2026-11-10',
      paid_until: '2026-12-10',
    });
  });

  it('should extend the paid period when paying on time', async () => {
    const membership = await subscribe();

    now = at(3, 8, 10);

    expect(
      await memberships.registerPayment(membership.id, {
        payment_method: 'credit',
        user_id: 'provider-id',
      }),
    ).toMatchObject({ cycle_anchor: '2026-10-05', paid_until: '2026-12-05' });
  });

  it('should handle requests made on the site', async () => {
    const plan = await plans.create(planData());
    const pending = await memberships.request(clientId, plan.id);

    expect(pending.status).toBe('pending');

    // Pedido pendente: ainda sem benefício, e sem pedir de novo
    expect((await book(haircut.id, at(6))).price_cents).toBe(5000);
    await expect(memberships.request(clientId, plan.id)).rejects.toMatchObject({
      message: 'Já existe um pedido de assinatura aguardando a barbearia.',
    });

    const active = await memberships.confirm(pending.id, {
      payment_method: 'pix',
      amount_cents: 9900,
      user_id: 'provider-id',
    });

    expect(active).toMatchObject({
      status: 'active',
      paid_until: '2026-11-05',
    });
    expect(paymentsRepository.payments[0].amount_cents).toBe(9900);
  });

  it('should return upcoming appointments to the normal price when canceled', async () => {
    const membership = await subscribe();
    const upcoming = await book(haircut.id, at(20));

    await memberships.cancel(membership.id);

    expect(upcoming).toMatchObject({
      membership_id: null,
      price_cents: 5000,
      list_price_cents: null,
    });
    expect(await memberships.forClient(clientId)).toBeNull();
  });

  it('should settle included appointments and show the fees in the cash register', async () => {
    await subscribe();

    const included = await book(haircut.id, at(5, 9));
    const other = await book(haircut.id, at(5, 10));

    now = at(5, 19);

    const done = await setAttendance.execute({
      appointment_id: included.id,
      attendance: 'completed',
      requester_id: 'provider-id',
      payment_method: 'membership',
    });

    expect(done).toMatchObject({
      payment_method: 'membership',
      paid_cents: null,
    });

    // "Incluso no plano" só no agendamento coberto pela assinatura
    Object.assign(other, { membership_id: null, list_price_cents: null });
    await expect(
      setAttendance.execute({
        appointment_id: other.id,
        attendance: 'completed',
        requester_id: 'provider-id',
        payment_method: 'membership',
      }),
    ).rejects.toBeInstanceOf(AppError);

    const day = await cash.show('2026-10-05');

    expect(day.memberships).toEqual([
      expect.objectContaining({
        client_name: `Cliente ${clientId}`,
        plan_name: 'Corte + Barba',
        amount_cents: 12900,
        payment_method: 'pix',
      }),
    ]);
    expect(day.totals.pix).toEqual({ count: 1, cents: 12900 });
    expect(day.totals.membership).toEqual({ count: 1, cents: 0 });
    expect(day.received_cents).toBe(12900);
  });

  it('should leave the plan when charged another way', async () => {
    await subscribe();
    const included = await book(haircut.id, at(5, 9));

    now = at(5, 19);

    const done = await setAttendance.execute({
      appointment_id: included.id,
      attendance: 'completed',
      requester_id: 'provider-id',
      payment_method: 'debit',
    });

    expect(done).toMatchObject({
      membership_id: null,
      price_cents: 5000,
      payment_method: 'debit',
    });
  });

  it('should summarize the club', async () => {
    await subscribe();
    const used = await book(haircut.id, at(5, 9));

    now = at(5, 19);
    await setAttendance.execute({
      appointment_id: used.id,
      attendance: 'completed',
      requester_id: 'provider-id',
      payment_method: 'membership',
    });

    const result = await overview.execute();

    expect(result.summary).toEqual({
      active: 1,
      overdue: 0,
      pending: 0,
      monthly_cents: 12900,
      canceled_last_30_days: 0,
    });
    expect(result.plans[0]).toMatchObject({
      subscribers: 1,
      received_cents: 12900,
      uses: 1,
      used_value_cents: 5000,
    });
  });
});
