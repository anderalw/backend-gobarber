import 'reflect-metadata';
import { runWithTenant } from '@shared/tenancy/TenantContext';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeNotificationsRepository from '@modules/notifications/repositories/fakes/FakeNotificationsRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeServicesRepository from '@modules/catalog/repositories/fakes/FakeServicesRepository';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import FeaturesService from '@modules/catalog/services/FeaturesService';
import Service from '@modules/catalog/infra/typeorm/entities/Service';
import FakeClientsRepository from '@modules/clients/repositories/fakes/FakeClientsRepository';
import ConsentService from '@modules/clients/services/ConsentService';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import FakeAppointmentsRepository from '@modules/appointments/repositories/fakes/FakeAppointmentsRepository';
import FakeTimeBlocksRepository from '@modules/appointments/repositories/fakes/FakeTimeBlocksRepository';
import FakeCashClosingsRepository from '@modules/appointments/repositories/fakes/FakeCashClosingsRepository';
import FakeClientNotifier from '@modules/appointments/notifier/FakeClientNotifier';
import CreateAppointmentsService from '@modules/appointments/services/CreateAppointmentsService';
import SetAttendanceService from '@modules/appointments/services/SetAttendanceService';
import CashRegisterService from '@modules/appointments/services/CashRegisterService';
import DepositService from '@modules/appointments/services/DepositService';
import FakeSessionPackagesRepository from '../repositories/fakes/FakeSessionPackagesRepository';
import PackagesService from './PackagesService';

let appointments: FakeAppointmentsRepository;
let clients: FakeClientsRepository;
let settings: FakeSettingsRepository;
let packages: PackagesService;
let createAppointment: CreateAppointmentsService;
let setAttendance: SetAttendanceService;
let deposits: DepositService;
let cash: CashRegisterService;
let consent: ConsentService;
let session: Service;
let tattoo: Service;
let clientId: string;
let now: Date;

const at = (day: number, hours = 10): Date => new Date(2026, 9, day, hours);

// Negócio de um ramo, com os recursos padrão dele
const tenant = (segment: string) => ({
  id: '00000000-0000-0000-0000-000000000003',
  slug: 'negocio',
  name: 'Negócio',
  custom_domain: null,
  status: 'active' as const,
  segment,
});

function book(service: Service, date: Date) {
  return createAppointment.execute({
    date,
    provider_id: 'provider-id',
    client_id: clientId,
    service_id: service.id,
  });
}

describe('Recursos próprios de cada ramo', () => {
  beforeEach(async () => {
    appointments = new FakeAppointmentsRepository();
    clients = new FakeClientsRepository();
    settings = new FakeSettingsRepository();
    const services = new FakeServicesRepository();
    const users = new FakeUsersRepository();
    const schedules = new FakeProviderSchedulesRepository();
    const packagesRepository = new FakeSessionPackagesRepository();
    const features = new FeaturesService(settings);

    packages = new PackagesService(
      packagesRepository,
      appointments,
      clients,
      services,
    );
    createAppointment = new CreateAppointmentsService(
      appointments,
      new FakeNotificationsRepository(),
      new FakeCacheProvider(),
      schedules,
      services,
      new AgendaSettingsService(settings),
      users,
      new FakeTimeBlocksRepository(),
      new FakeClientNotifier(),
      undefined,
      features,
      packages,
    );
    setAttendance = new SetAttendanceService(appointments);
    deposits = new DepositService(appointments, settings);
    cash = new CashRegisterService(
      appointments,
      new FakeCashClosingsRepository(),
      users,
      undefined,
      packagesRepository,
    );
    consent = new ConsentService(settings, clients, features);

    const provider = await users.create({
      name: 'Profissional',
      email: 'profissional@example.com',
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

    session = await services.create({
      name: 'Sessão de fisioterapia',
      duration_minutes: 50,
      price_cents: 12000,
    });
    tattoo = await services.create({
      name: 'Tatuagem média',
      duration_minutes: 180,
      price_cents: 80000,
      deposit_cents: 20000,
    });

    clientId = (
      await clients.create({
        name: 'Paula',
        email: null,
        password: null,
        phone: '11999990000',
      })
    ).id;

    now = at(5, 8);
    jest.spyOn(Date, 'now').mockImplementation(() => now.getTime());
  });

  it('should cover sessions with a package until it is used up', async () => {
    await runWithTenant(tenant('physio'), async () => {
      const sold = await packages.create({
        client_id: clientId,
        service_id: session.id,
        sessions: 2,
        price_cents: 20000,
        payment_method: 'pix',
        user_id: 'provider-id',
      });

      const first = await book(session, at(6));
      const second = await book(session, at(7));
      const third = await book(session, at(8));

      expect(first).toMatchObject({
        package_id: sold.id,
        price_cents: 0,
        list_price_cents: 12000,
      });
      expect(second.package_id).toBe(sold.id);
      expect(third).toMatchObject({ package_id: null, price_cents: 12000 });

      const [view] = await packages.listByClient(clientId);

      expect(view).toMatchObject({ used: 2, remaining: 0, state: 'used_up' });

      // A venda entra no caixa do dia
      const day = await cash.show('2026-10-05');

      expect(day.received_cents).toBe(20000);
      expect(day.others).toEqual([
        expect.objectContaining({ kind: 'package', amount_cents: 20000 }),
      ]);
    });
  });

  it('should give the session back when the client pays it apart', async () => {
    await runWithTenant(tenant('physio'), async () => {
      await packages.create({
        client_id: clientId,
        service_id: session.id,
        sessions: 1,
        price_cents: 10000,
        payment_method: 'cash',
        user_id: 'provider-id',
      });

      const appointment = await book(session, at(5, 9));

      now = at(5, 10);
      await setAttendance.execute({
        appointment_id: appointment.id,
        attendance: 'completed',
        payment_method: 'pix',
        requester_id: 'provider-id',
      });

      const [view] = await packages.listByClient(clientId);

      expect(view.remaining).toBe(1);
      expect((await appointments.findById(appointment.id))?.price_cents).toBe(
        12000,
      );
    });
  });

  it('should bring the normal price back when the package is canceled', async () => {
    await runWithTenant(tenant('physio'), async () => {
      const sold = await packages.create({
        client_id: clientId,
        service_id: session.id,
        sessions: 5,
        price_cents: 50000,
        payment_method: 'pix',
        user_id: 'provider-id',
      });

      const appointment = await book(session, at(9));

      await packages.cancel(sold.id);

      expect(await appointments.findById(appointment.id)).toMatchObject({
        package_id: null,
        price_cents: 12000,
      });
      expect((await book(session, at(10))).package_id).toBeNull();
    });
  });

  it('should not use packages where the feature is off', async () => {
    await runWithTenant(tenant('barbershop'), async () => {
      await packages.create({
        client_id: clientId,
        service_id: session.id,
        sessions: 5,
        price_cents: 50000,
        payment_method: 'pix',
        user_id: 'provider-id',
      });

      expect((await book(session, at(6))).package_id).toBeNull();
    });
  });

  it('should ask for a deposit and count it in the cash of the day it was paid', async () => {
    await runWithTenant(tenant('tattoo'), async () => {
      const appointment = await book(tattoo, at(7, 14));

      expect(appointment.deposit_cents).toBe(20000);

      await deposits.receive({
        appointment_id: appointment.id,
        payment_method: 'pix',
        user_id: 'provider-id',
      });

      expect((await cash.show('2026-10-05')).received_cents).toBe(20000);

      // No dia: entra só o que faltava
      now = at(7, 18);
      await setAttendance.execute({
        appointment_id: appointment.id,
        attendance: 'completed',
        payment_method: 'credit',
        requester_id: 'provider-id',
      });

      const day = await cash.show('2026-10-07');

      expect(day.received_cents).toBe(60000);
      expect(day.items[0]).toMatchObject({
        received_cents: 60000,
        deposit_cents: 20000,
      });
    });
  });

  it('should not ask for a deposit where the feature is off', async () => {
    await runWithTenant(tenant('physio'), async () => {
      expect((await book(tattoo, at(7, 14))).deposit_cents).toBeNull();
    });
  });

  it('should ask for a new acceptance when the term changes', async () => {
    await runWithTenant(tenant('clinic'), async () => {
      await expect(consent.ensureAccepted(clientId)).rejects.toMatchObject({
        message: 'Leia e aceite o termo de consentimento para agendar.',
      });

      const { version } = await consent.term();
      const accepted = await consent.accept(clientId, version);

      expect(accepted).toMatchObject({ accepted: true, in_person: false });
      await expect(consent.ensureAccepted(clientId)).resolves.toBeUndefined();

      await consent.update('Novo texto do termo.');

      expect((await consent.status(clientId)).accepted).toBe(false);
      await expect(consent.accept(clientId, version)).rejects.toMatchObject({
        message: 'O termo foi atualizado. Leia de novo para aceitar.',
      });

      const inPerson = await consent.accept(clientId, null, 'provider-id');

      expect(inPerson).toMatchObject({ accepted: true, in_person: true });
    });

    // Barbearia: sem o recurso, não pede
    await expect(consent.ensureAccepted(clientId)).resolves.toBeUndefined();
  });
});
