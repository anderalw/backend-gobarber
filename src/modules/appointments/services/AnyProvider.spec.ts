import AppError from '@shared/errors/AppError';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeServicesRepository from '@modules/catalog/repositories/fakes/FakeServicesRepository';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import FakeNotificationsRepository from '@modules/notifications/repositories/fakes/FakeNotificationsRepository';
import Service from '@modules/catalog/infra/typeorm/entities/Service';
import User from '@modules/users/infra/typeorm/entities/User';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import ListProviderDayAvailabilityService from './ListProviderDayAvailabilityService';
import ListAnyProviderDayAvailabilityService from './ListAnyProviderDayAvailabilityService';
import CreateAppointmentsService from './CreateAppointmentsService';
import CreateAnyProviderAppointmentService from './CreateAnyProviderAppointmentService';

let fakeUsersRepository: FakeUsersRepository;
let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeProviderSchedulesRepository: FakeProviderSchedulesRepository;
let listAny: ListAnyProviderDayAvailabilityService;
let createAny: CreateAnyProviderAppointmentService;
let haircut: Service;
let ana: User;
let bruno: User;

// 10/08/2020 é segunda-feira
const monday = (hours: number): Date => new Date(2020, 7, 10, hours);

describe('Qualquer barbeiro', () => {
  beforeEach(async () => {
    fakeUsersRepository = new FakeUsersRepository();
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeProviderSchedulesRepository = new FakeProviderSchedulesRepository();
    const fakeServicesRepository = new FakeServicesRepository();
    const agendaSettings = new AgendaSettingsService(
      new FakeSettingsRepository(),
    );

    listAny = new ListAnyProviderDayAvailabilityService(
      fakeUsersRepository,
      new ListProviderDayAvailabilityService(
        fakeAppointmentsRepository,
        fakeProviderSchedulesRepository,
        fakeServicesRepository,
        agendaSettings,
      ),
    );

    createAny = new CreateAnyProviderAppointmentService(
      fakeUsersRepository,
      fakeAppointmentsRepository,
      fakeServicesRepository,
      new CreateAppointmentsService(
        fakeAppointmentsRepository,
        new FakeNotificationsRepository(),
        new FakeCacheProvider(),
        fakeProviderSchedulesRepository,
        fakeServicesRepository,
        agendaSettings,
        fakeUsersRepository,
      ),
    );

    haircut = await fakeServicesRepository.create({
      name: 'Cabelo',
      duration_minutes: 60,
      price_cents: 4500,
    });

    ana = await fakeUsersRepository.create({
      name: 'Ana',
      email: 'ana@example.test',
      password: '123456',
    });
    bruno = await fakeUsersRepository.create({
      name: 'Bruno',
      email: 'bruno@example.test',
      password: '123456',
    });

    await fakeProviderSchedulesRepository.replaceByProviderId(ana.id, [
      { day_of_week: 1, start_time: '08:00', end_time: '10:00' },
    ]);
    await fakeProviderSchedulesRepository.replaceByProviderId(bruno.id, [
      { day_of_week: 1, start_time: '09:00', end_time: '12:00' },
    ]);

    // "Agora" é domingo, véspera
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 7, 9, 12).getTime();
    });
  });

  it('should list the times when at least one active provider is free', async () => {
    // Ana ocupada às 08:00; Carla (desativada) não conta
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: ana.id,
        client_id: 'client-id',
        date: monday(8),
      }),
    );
    const carla = await fakeUsersRepository.create({
      name: 'Carla',
      email: 'carla@example.test',
      password: '123456',
    });
    carla.active = false;
    await fakeProviderSchedulesRepository.replaceByProviderId(carla.id, [
      { day_of_week: 1, start_time: '07:00', end_time: '08:00' },
    ]);

    const times = await listAny.execute({
      service_id: haircut.id,
      day: 10,
      month: 8,
      year: 2020,
    });

    expect(times).toEqual([
      { time: '09:00' },
      { time: '10:00' },
      { time: '11:00' },
    ]);
  });

  it('should book with the free provider that has fewer appointments that day', async () => {
    // Os dois estão livres às 09:00; Ana já tem um atendimento no dia
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: ana.id,
        client_id: 'client-id',
        date: monday(8),
      }),
    );

    const appointment = await createAny.execute({
      client_id: 'client-id',
      service_id: haircut.id,
      date: monday(9),
    });

    expect(appointment.provider_id).toBe(bruno.id);
  });

  it('should skip providers that cannot take the time', async () => {
    // Ana tem menos atendimentos, mas não atende às 11:00
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: bruno.id,
        client_id: 'client-id',
        date: monday(9),
      }),
    );

    const appointment = await createAny.execute({
      client_id: 'client-id',
      service_id: haircut.id,
      date: monday(11),
    });

    expect(appointment.provider_id).toBe(bruno.id);
  });

  it('should not book when nobody is free', async () => {
    await expect(
      createAny.execute({
        client_id: 'client-id',
        service_id: haircut.id,
        date: monday(13),
      }),
    ).rejects.toMatchObject({
      message:
        'Nenhum barbeiro está livre neste horário. Escolha outro horário.',
    });
  });

  it('should not book in the past', async () => {
    await expect(
      createAny.execute({
        client_id: 'client-id',
        service_id: haircut.id,
        date: new Date(2020, 7, 9, 9),
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
