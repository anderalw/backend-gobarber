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
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeClientNotifier from '../notifier/FakeClientNotifier';
import FakeTimeBlocksRepository from '../repositories/fakes/FakeTimeBlocksRepository';
import CreateAppointmentsService from './CreateAppointmentsService';
import CreateProviderAppointmentService from './CreateProviderAppointmentService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeNotificationsRepository: FakeNotificationsRepository;
let fakeClientsRepository: FakeClientsRepository;
let createByProvider: CreateProviderAppointmentService;
let haircut: Service;
let barber: User;
let otherBarber: User;
let client: Client;

describe('CreateProviderAppointment', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeNotificationsRepository = new FakeNotificationsRepository();
    fakeClientsRepository = new FakeClientsRepository();
    const fakeUsersRepository = new FakeUsersRepository();
    const fakeProviderSchedulesRepository =
      new FakeProviderSchedulesRepository();
    const fakeServicesRepository = new FakeServicesRepository();

    createByProvider = new CreateProviderAppointmentService(
      fakeClientsRepository,
      fakeUsersRepository,
      new CreateAppointmentsService(
        fakeAppointmentsRepository,
        fakeNotificationsRepository,
        new FakeCacheProvider(),
        fakeProviderSchedulesRepository,
        fakeServicesRepository,
        new AgendaSettingsService(new FakeSettingsRepository()),
        fakeUsersRepository,
        new FakeTimeBlocksRepository(),
        new FakeClientNotifier(),
      ),
    );

    barber = await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.com',
      password: '123456',
    });
    otherBarber = await fakeUsersRepository.create({
      name: 'Luis',
      email: 'luis@example.com',
      password: '123456',
    });
    client = await fakeClientsRepository.create({
      name: 'Maria',
      email: 'maria@example.com',
      password: '123456',
      phone: '11999990000',
    });
    haircut = await fakeServicesRepository.create({
      name: 'Cabelo',
      duration_minutes: 45,
      price_cents: 4500,
    });

    // Os dois barbeiros atendem de segunda a sábado, das 08:00 às 18:00
    await Promise.all(
      [barber, otherBarber].map(provider =>
        fakeProviderSchedulesRepository.replaceByProviderId(
          provider.id,
          [1, 2, 3, 4, 5, 6].map(day_of_week => ({
            day_of_week,
            start_time: '08:00',
            end_time: '18:00',
          })),
        ),
      ),
    );

    // "Agora" é segunda-feira, 10/08/2020 às 12h
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 7, 10, 12).getTime();
    });
  });

  it('should book a client for the barber', async () => {
    const appointment = await createByProvider.execute({
      requester_id: barber.id,
      provider_id: barber.id,
      service_id: haircut.id,
      date: new Date(2020, 7, 10, 13),
      client_id: client.id,
    });

    expect(appointment).toMatchObject({
      client_id: client.id,
      provider_id: barber.id,
      end_date: new Date(2020, 7, 10, 13, 45),
    });
  });

  it('should only notify when booking for another barber', async () => {
    const notify = jest.spyOn(fakeNotificationsRepository, 'create');

    await createByProvider.execute({
      requester_id: barber.id,
      provider_id: barber.id,
      service_id: haircut.id,
      date: new Date(2020, 7, 10, 13),
      client_id: client.id,
    });

    expect(notify).not.toHaveBeenCalled();

    await createByProvider.execute({
      requester_id: barber.id,
      provider_id: otherBarber.id,
      service_id: haircut.id,
      date: new Date(2020, 7, 10, 13),
      client_id: client.id,
    });

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipient_id: otherBarber.id }),
    );
  });

  it('should follow the same rules as client bookings', async () => {
    await createByProvider.execute({
      requester_id: barber.id,
      provider_id: barber.id,
      service_id: haircut.id,
      date: new Date(2020, 7, 10, 13),
      client_id: client.id,
    });

    // Horário ocupado
    await expect(
      createByProvider.execute({
        requester_id: barber.id,
        provider_id: barber.id,
        service_id: haircut.id,
        date: new Date(2020, 7, 10, 13, 30),
        client_id: client.id,
      }),
    ).rejects.toBeInstanceOf(AppError);

    // Fora do expediente
    await expect(
      createByProvider.execute({
        requester_id: barber.id,
        provider_id: barber.id,
        service_id: haircut.id,
        date: new Date(2020, 7, 10, 17, 30),
        client_id: client.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should reject unknown clients and barbers', async () => {
    const base = {
      requester_id: barber.id,
      provider_id: barber.id,
      service_id: haircut.id,
      date: new Date(2020, 7, 10, 13),
      client_id: client.id,
    };

    await expect(
      createByProvider.execute({ ...base, client_id: 'unknown-client' }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      createByProvider.execute({ ...base, provider_id: 'unknown-barber' }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
