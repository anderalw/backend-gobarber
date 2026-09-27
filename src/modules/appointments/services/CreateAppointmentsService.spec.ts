import AppError from '@shared/errors/AppError';
import FakeNotificationsRepository from '@modules/notifications/repositories/fakes/FakeNotificationsRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import CreateAppointmentsService from './CreateAppointmentsService';

let fakeCacheProvider: FakeCacheProvider;
let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeNotificationsRepository: FakeNotificationsRepository;
let fakeProviderSchedulesRepository: FakeProviderSchedulesRepository;
let createAppointment: CreateAppointmentsService;

describe('CreateAppointment', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeCacheProvider = new FakeCacheProvider();
    fakeNotificationsRepository = new FakeNotificationsRepository();
    fakeProviderSchedulesRepository = new FakeProviderSchedulesRepository();
    createAppointment = new CreateAppointmentsService(
      fakeAppointmentsRepository,
      fakeNotificationsRepository,
      fakeCacheProvider,
      fakeProviderSchedulesRepository,
    );

    // Segunda a sábado, das 08:00 às 18:00
    await fakeProviderSchedulesRepository.createMany(
      [1, 2, 3, 4, 5, 6].map(day_of_week => ({
        provider_id: 'provider-id',
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

  it('Should be able to create a new appointment', async () => {
    const appointment = await createAppointment.execute({
      date: new Date(2020, 7, 10, 13),
      provider_id: 'provider-id',
      client_id: 'client-id',
    });

    expect(appointment).toHaveProperty('id');
    expect(appointment.provider_id).toBe('provider-id');
    expect(appointment.client_id).toBe('client-id');
  });

  it('should not be albe to create two appointments on the same date', async () => {
    const appointmentDate = new Date(2020, 7, 25, 11);

    await createAppointment.execute({
      date: appointmentDate,
      provider_id: 'provider-id',
      client_id: 'client-id',
    });

    await expect(
      createAppointment.execute({
        date: appointmentDate,
        provider_id: 'provider-id',
        client_id: 'client-id',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('Should not to be able to create an appointment on a past date', async () => {
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 10, 11),
        provider_id: 'provider-id',
        client_id: 'client-id',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('Should not to be able to create an appointment with same user as provider', async () => {
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 10, 13),
        provider_id: 'provider-id',
        client_id: 'provider-id',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('Should not to be able to create an appointment outside the provider working hours', async () => {
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 11, 7),
        provider_id: 'provider-id',
        client_id: 'client-id',
      }),
    ).rejects.toBeInstanceOf(AppError);

    // 18h é o fim do expediente, o último horário é 17h
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 11, 18),
        provider_id: 'provider-id',
        client_id: 'client-id',
      }),
    ).rejects.toBeInstanceOf(AppError);

    const lastSlot = await createAppointment.execute({
      date: new Date(2020, 7, 11, 17),
      provider_id: 'provider-id',
      client_id: 'client-id',
    });

    expect(lastSlot).toHaveProperty('id');
  });

  it('Should not to be able to create an appointment on a day the provider does not work', async () => {
    // 16/08/2020 é domingo
    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 16, 10),
        provider_id: 'provider-id',
        client_id: 'client-id',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('Should respect a custom schedule of the provider', async () => {
    await fakeProviderSchedulesRepository.createMany([
      {
        provider_id: 'night-provider',
        day_of_week: 2,
        start_time: '18:00',
        end_time: '21:00',
      },
    ]);

    const appointment = await createAppointment.execute({
      date: new Date(2020, 7, 11, 20),
      provider_id: 'night-provider',
      client_id: 'client-id',
    });

    expect(appointment).toHaveProperty('id');

    await expect(
      createAppointment.execute({
        date: new Date(2020, 7, 11, 10),
        provider_id: 'night-provider',
        client_id: 'client-id',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
