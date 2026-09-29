import AppError from '@shared/errors/AppError';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeNotificationsRepository from '@modules/notifications/repositories/fakes/FakeNotificationsRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeServicesRepository from '@modules/catalog/repositories/fakes/FakeServicesRepository';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import Service from '@modules/catalog/infra/typeorm/entities/Service';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeTimeBlocksRepository from '../repositories/fakes/FakeTimeBlocksRepository';
import CreateAppointmentsService from './CreateAppointmentsService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeNotificationsRepository: FakeNotificationsRepository;
let fakeProviderSchedulesRepository: FakeProviderSchedulesRepository;
let fakeServicesRepository: FakeServicesRepository;
let agendaSettings: AgendaSettingsService;
let createAppointment: CreateAppointmentsService;
let fakeUsersRepository: FakeUsersRepository;
let haircut: Service;

describe('CreateAppointment', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeNotificationsRepository = new FakeNotificationsRepository();
    fakeProviderSchedulesRepository = new FakeProviderSchedulesRepository();
    fakeServicesRepository = new FakeServicesRepository();
    agendaSettings = new AgendaSettingsService(new FakeSettingsRepository());
    fakeUsersRepository = new FakeUsersRepository();
    createAppointment = new CreateAppointmentsService(
      fakeAppointmentsRepository,
      fakeNotificationsRepository,
      new FakeCacheProvider(),
      fakeProviderSchedulesRepository,
      fakeServicesRepository,
      agendaSettings,
      fakeUsersRepository,
      new FakeTimeBlocksRepository(),
    );

    // Barbeiro dos testes, com o id fixo usado nos agendamentos
    const provider = await fakeUsersRepository.create({
      name: 'Barbeiro',
      email: 'barbeiro@example.test',
      password: '123456',
    });
    provider.id = 'provider-id';

    haircut = await fakeServicesRepository.create({
      name: 'Cabelo',
      duration_minutes: 45,
      price_cents: 4500,
    });

    // Segunda a sábado, das 08:00 às 18:00
    await fakeProviderSchedulesRepository.replaceByProviderId(
      'provider-id',
      [1, 2, 3, 4, 5, 6].map(day_of_week => ({
        day_of_week,
        start_time: '08:00',
        end_time: '18:00',
      })),
    );

    // "Agora" é segunda-feira, 10/08/2020 às 12h
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 7, 10, 12).getTime();
    });
  });

  it('should create an appointment lasting the service duration', async () => {
    const appointment = await createAppointment.execute({
      date: new Date(2020, 7, 10, 13),
      provider_id: 'provider-id',
      client_id: 'client-id',
      service_id: haircut.id,
    });

    expect(appointment).toMatchObject({
      provider_id: 'provider-id',
      client_id: 'client-id',
      service_id: haircut.id,
      price_cents: 4500,
      date: new Date(2020, 7, 10, 13),
      end_date: new Date(2020, 7, 10, 13, 45),
      // Sem intervalo configurado, ocupa só o tempo do serviço
      blocked_until: new Date(2020, 7, 10, 13, 45),
    });
  });

  it('should block the buffer after the appointment', async () => {
    await agendaSettings.update({ buffer_minutes: 15 });

    const appointment = await createAppointment.execute({
      date: new Date(2020, 7, 10, 13),
      provider_id: 'provider-id',
      client_id: 'client-id',
      service_id: haircut.id,
    });

    expect(appointment.blocked_until).toEqual(new Date(2020, 7, 10, 14));

    // 13:45 cairia dentro do intervalo do atendimento anterior
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 10, 13, 45),
        provider_id: 'provider-id',
        client_id: 'other-client',
        service_id: haircut.id,
      }),
    ).rejects.toBeInstanceOf(AppError);

    // 14:00 já está livre
    const next = await createAppointment.execute({
      date: new Date(2020, 7, 10, 14),
      provider_id: 'provider-id',
      client_id: 'other-client',
      service_id: haircut.id,
    });

    expect(next).toHaveProperty('id');
  });

  it('should keep the price of the moment of the booking', async () => {
    const appointment = await createAppointment.execute({
      date: new Date(2020, 7, 10, 13),
      provider_id: 'provider-id',
      client_id: 'client-id',
      service_id: haircut.id,
    });

    haircut.price_cents = 6000;
    await fakeServicesRepository.save(haircut);

    expect(appointment.price_cents).toBe(4500);
  });

  it('should not create overlapping appointments', async () => {
    await createAppointment.execute({
      date: new Date(2020, 7, 25, 11),
      provider_id: 'provider-id',
      client_id: 'client-id',
      service_id: haircut.id,
    });

    // Mesmo horário
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 25, 11),
        provider_id: 'provider-id',
        client_id: 'other-client',
        service_id: haircut.id,
      }),
    ).rejects.toBeInstanceOf(AppError);

    // Começa antes e termina durante o outro (10:30 às 11:15)
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 25, 10, 30),
        provider_id: 'provider-id',
        client_id: 'other-client',
        service_id: haircut.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should not create an appointment on a past date', async () => {
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 10, 11),
        provider_id: 'provider-id',
        client_id: 'client-id',
        service_id: haircut.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should not create an appointment with same user as provider', async () => {
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 10, 13),
        provider_id: 'provider-id',
        client_id: 'provider-id',
        service_id: haircut.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should only accept appointments that fit in the working hours', async () => {
    // Antes de abrir
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 11, 7, 30),
        provider_id: 'provider-id',
        client_id: 'client-id',
        service_id: haircut.id,
      }),
    ).rejects.toBeInstanceOf(AppError);

    // 17:30 + 45 min = 18:15, passa do fim do expediente
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 11, 17, 30),
        provider_id: 'provider-id',
        client_id: 'client-id',
        service_id: haircut.id,
      }),
    ).rejects.toBeInstanceOf(AppError);

    // 17:15 + 45 min = 18:00, cabe exatamente
    const lastSlot = await createAppointment.execute({
      date: new Date(2020, 7, 11, 17, 15),
      provider_id: 'provider-id',
      client_id: 'client-id',
      service_id: haircut.id,
    });

    expect(lastSlot).toHaveProperty('id');
  });

  it('should not create an appointment on a day the provider does not work', async () => {
    // 16/08/2020 é domingo
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 16, 10),
        provider_id: 'provider-id',
        client_id: 'client-id',
        service_id: haircut.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should not create an appointment with an inactive or unknown service', async () => {
    haircut.active = false;
    await fakeServicesRepository.save(haircut);

    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 10, 13),
        provider_id: 'provider-id',
        client_id: 'client-id',
        service_id: haircut.id,
      }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 10, 13),
        provider_id: 'provider-id',
        client_id: 'client-id',
        service_id: 'unknown',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should not create an appointment with a deactivated provider', async () => {
    const provider = await fakeUsersRepository.findById('provider-id');
    if (provider) provider.active = false;

    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 10, 13),
        provider_id: 'provider-id',
        client_id: 'client-id',
        service_id: haircut.id,
      }),
    ).rejects.toMatchObject({
      message: 'Este barbeiro não está atendendo no momento.',
    });
  });
});
