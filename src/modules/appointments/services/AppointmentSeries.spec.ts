import AppError from '@shared/errors/AppError';
import FakeNotificationsRepository from '@modules/notifications/repositories/fakes/FakeNotificationsRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeClientsRepository from '@modules/clients/repositories/fakes/FakeClientsRepository';
import FakeServicesRepository from '@modules/catalog/repositories/fakes/FakeServicesRepository';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import Service from '@modules/catalog/infra/typeorm/entities/Service';
import User from '@modules/users/infra/typeorm/entities/User';
import Client from '@modules/clients/infra/typeorm/entities/Client';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import NotifyWaitlistService from './NotifyWaitlistService';
import FakeWaitlistRepository from '../repositories/fakes/FakeWaitlistRepository';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeAppointmentSeriesRepository from '../repositories/fakes/FakeAppointmentSeriesRepository';
import FakeClientNotifier from '../notifier/FakeClientNotifier';
import FakeTimeBlocksRepository from '../repositories/fakes/FakeTimeBlocksRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import CheckSlotService from './CheckSlotService';
import CreateAppointmentsService from './CreateAppointmentsService';
import CreateAppointmentSeriesService from './CreateAppointmentSeriesService';
import CancelSeriesService from './CancelSeriesService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeNotificationsRepository: FakeNotificationsRepository;
let fakeClientNotifier: FakeClientNotifier;
let createSeries: CreateAppointmentSeriesService;
let cancelSeries: CancelSeriesService;
let haircut: Service;
let barber: User;
let other: User;
let client: Client;

// Segundas-feiras de agosto e setembro de 2020, às 10h
const monday = (day: number, month = 8): Date =>
  new Date(2020, month - 1, day, 10);

describe('Cliente fixo', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeNotificationsRepository = new FakeNotificationsRepository();
    fakeClientNotifier = new FakeClientNotifier();
    const fakeClientsRepository = new FakeClientsRepository();
    const fakeUsersRepository = new FakeUsersRepository();
    const fakeProviderSchedulesRepository =
      new FakeProviderSchedulesRepository();
    const fakeServicesRepository = new FakeServicesRepository();
    const agendaSettings = new AgendaSettingsService(
      new FakeSettingsRepository(),
    );
    const fakeTimeBlocksRepository = new FakeTimeBlocksRepository();
    const fakeCacheProvider = new FakeCacheProvider();

    createSeries = new CreateAppointmentSeriesService(
      fakeClientsRepository,
      fakeUsersRepository,
      fakeAppointmentsRepository,
      new FakeAppointmentSeriesRepository(),
      fakeNotificationsRepository,
      fakeClientNotifier,
      new CheckSlotService(
        fakeAppointmentsRepository,
        fakeProviderSchedulesRepository,
        fakeServicesRepository,
        agendaSettings,
        fakeUsersRepository,
        fakeTimeBlocksRepository,
      ),
      new CreateAppointmentsService(
        fakeAppointmentsRepository,
        fakeNotificationsRepository,
        fakeCacheProvider,
        fakeProviderSchedulesRepository,
        fakeServicesRepository,
        agendaSettings,
        fakeUsersRepository,
        fakeTimeBlocksRepository,
        fakeClientNotifier,
      ),
    );
    cancelSeries = new CancelSeriesService(
      fakeAppointmentsRepository,
      fakeNotificationsRepository,
      fakeCacheProvider,
      fakeClientNotifier,
      new NotifyWaitlistService(
        new FakeWaitlistRepository(),
        fakeAppointmentsRepository,
        fakeNotificationsRepository,
        fakeClientNotifier,
      ),
    );

    barber = await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.com',
      password: '123456',
    });
    other = await fakeUsersRepository.create({
      name: 'Luis',
      email: 'luis@example.com',
      password: '123456',
    });
    client = await fakeClientsRepository.create({
      name: 'Maria',
      email: 'maria@example.com',
      password: null,
      phone: '11999990000',
    });
    haircut = await fakeServicesRepository.create({
      name: 'Cabelo',
      duration_minutes: 45,
      price_cents: 4500,
    });

    // Segunda a sábado, das 08:00 às 18:00
    await fakeProviderSchedulesRepository.replaceByProviderId(
      barber.id,
      [1, 2, 3, 4, 5, 6].map(day_of_week => ({
        day_of_week,
        start_time: '08:00',
        end_time: '18:00',
      })),
    );

    // "Agora" é segunda-feira, 10/08/2020 às 8h
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => new Date(2020, 7, 10, 8).getTime());
  });

  const request = {
    date: monday(10),
    interval_weeks: 2,
    count: 4,
  };

  it('should preview the dates, showing the ones that are taken', async () => {
    // 24/08 às 10h já está ocupado
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: barber.id,
        client_id: 'someone',
        date: monday(24),
      }),
    );

    const preview = await createSeries.execute({
      ...request,
      requester_id: other.id,
      provider_id: barber.id,
      service_id: haircut.id,
      client_id: client.id,
      dry_run: true,
    });

    expect(preview.series_id).toBeNull();
    expect(preview.created).toBe(3);
    expect(
      preview.occurrences.map(item => [item.date, item.available]),
    ).toEqual([
      [monday(10), true],
      [monday(24), false],
      [monday(7, 9), true],
      [monday(21, 9), true],
    ]);
    expect(preview.occurrences[1].reason).toBe(
      'Este horário já está reservado.',
    );
    // A prévia não marca nada
    expect(
      await fakeAppointmentsRepository.findFollowingInSeries('x', monday(1)),
    ).toEqual([]);
  });

  it('should book the free dates, with one notice for the whole series', async () => {
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: barber.id,
        client_id: 'someone',
        date: monday(24),
      }),
    );

    const result = await createSeries.execute({
      ...request,
      requester_id: other.id,
      provider_id: barber.id,
      service_id: haircut.id,
      client_id: client.id,
    });

    expect(result.created).toBe(3);

    const booked = await fakeAppointmentsRepository.findFollowingInSeries(
      result.series_id as string,
      monday(1),
    );

    expect(booked.map(item => item.date)).toEqual([
      monday(10),
      monday(7, 9),
      monday(21, 9),
    ]);
    // Um e-mail com os três horários, sem os avisos de cada um
    expect(fakeClientNotifier.sent).toEqual([
      expect.objectContaining({ kind: 'series-created', count: 3 }),
    ]);
    expect(await fakeNotificationsRepository.countUnread(barber.id)).toBe(1);
  });

  it('should cancel an appointment and the following ones of the series', async () => {
    const { series_id } = await createSeries.execute({
      ...request,
      requester_id: barber.id,
      provider_id: barber.id,
      service_id: haircut.id,
      client_id: client.id,
    });

    const all = await fakeAppointmentsRepository.findFollowingInSeries(
      series_id as string,
      monday(1),
    );

    const canceled = await cancelSeries.execute({
      appointment_id: all[2].id,
      requester_id: barber.id,
    });

    expect(canceled.map(item => item.date)).toEqual([
      monday(7, 9),
      monday(21, 9),
    ]);
    // Os dois primeiros continuam marcados
    expect(
      (
        await fakeAppointmentsRepository.findFollowingInSeries(
          series_id as string,
          monday(1),
        )
      ).map(item => item.date),
    ).toEqual([monday(10), monday(24)]);
    expect(fakeClientNotifier.sent.pop()).toMatchObject({
      kind: 'series-canceled',
      count: 2,
    });
  });

  it('should not cancel the series of an appointment without one', async () => {
    const single = await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: barber.id,
        client_id: client.id,
        date: monday(17),
      }),
    );

    await expect(
      cancelSeries.execute({
        appointment_id: single.id,
        requester_id: barber.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should validate the repetition and fail when nothing is free', async () => {
    await expect(
      createSeries.execute({
        ...request,
        interval_weeks: 9,
        requester_id: barber.id,
        provider_id: barber.id,
        service_id: haircut.id,
        client_id: client.id,
      }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      createSeries.execute({
        ...request,
        count: 1,
        requester_id: barber.id,
        provider_id: barber.id,
        service_id: haircut.id,
        client_id: client.id,
      }),
    ).rejects.toBeInstanceOf(AppError);

    // Domingo: o barbeiro não atende
    await expect(
      createSeries.execute({
        ...request,
        date: new Date(2020, 7, 16, 10),
        requester_id: barber.id,
        provider_id: barber.id,
        service_id: haircut.id,
        client_id: client.id,
      }),
    ).rejects.toMatchObject({ message: 'Nenhum dos horários está livre.' });
  });
});
