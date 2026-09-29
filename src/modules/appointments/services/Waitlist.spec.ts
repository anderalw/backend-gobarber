import AppError from '@shared/errors/AppError';
import FakeNotificationsRepository from '@modules/notifications/repositories/fakes/FakeNotificationsRepository';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeClientsRepository from '@modules/clients/repositories/fakes/FakeClientsRepository';
import FakeServicesRepository from '@modules/catalog/repositories/fakes/FakeServicesRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import Client from '@modules/clients/infra/typeorm/entities/Client';
import User from '@modules/users/infra/typeorm/entities/User';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeWaitlistRepository from '../repositories/fakes/FakeWaitlistRepository';
import FakeClientNotifier from '../notifier/FakeClientNotifier';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import WaitlistService from './WaitlistService';
import NotifyWaitlistService from './NotifyWaitlistService';
import CancelAppointmentService from './CancelAppointmentService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeWaitlistRepository: FakeWaitlistRepository;
let fakeClientsRepository: FakeClientsRepository;
let fakeNotificationsRepository: FakeNotificationsRepository;
let fakeClientNotifier: FakeClientNotifier;
let waitlist: WaitlistService;
let cancelAppointment: CancelAppointmentService;
let carlos: User;
let luis: User;
let maria: Client;
let pedro: Client;
let ana: Client;

// "Agora" é 10/08/2020 às 8h; o dia lotado é 12/08
const DAY = '2020-08-12';
const at = (hours: number): Date => new Date(2020, 7, 12, hours);

async function newClient(name: string, email: string | null = null) {
  return fakeClientsRepository.create({
    name,
    email,
    password: null,
    phone: '11999990000',
  });
}

async function book(client: Client | null, provider: User, hours: number) {
  const appointment = await fakeAppointmentsRepository.create(
    makeAppointmentData({
      provider_id: provider.id,
      client_id: client ? client.id : 'someone',
      date: at(hours),
    }),
  );

  appointment.provider = provider;

  return appointment;
}

describe('Lista de espera', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeWaitlistRepository = new FakeWaitlistRepository();
    fakeClientsRepository = new FakeClientsRepository();
    fakeNotificationsRepository = new FakeNotificationsRepository();
    fakeClientNotifier = new FakeClientNotifier();
    const fakeUsersRepository = new FakeUsersRepository();
    const fakeProviderSchedulesRepository =
      new FakeProviderSchedulesRepository();

    waitlist = new WaitlistService(
      fakeWaitlistRepository,
      fakeClientsRepository,
      fakeUsersRepository,
      new FakeServicesRepository(),
      fakeAppointmentsRepository,
      fakeProviderSchedulesRepository,
    );
    cancelAppointment = new CancelAppointmentService(
      fakeAppointmentsRepository,
      fakeNotificationsRepository,
      new FakeCacheProvider(),
      fakeClientNotifier,
      new NotifyWaitlistService(
        fakeWaitlistRepository,
        fakeAppointmentsRepository,
        fakeNotificationsRepository,
        fakeClientNotifier,
      ),
    );

    carlos = await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.test',
      password: '123456',
    });
    luis = await fakeUsersRepository.create({
      name: 'Luis',
      email: 'luis@example.test',
      password: '123456',
    });
    // Carlos atende de segunda a sábado; Luis só às quartas
    await fakeProviderSchedulesRepository.replaceByProviderId(
      carlos.id,
      [1, 2, 3, 4, 5, 6].map(day_of_week => ({
        day_of_week,
        start_time: '08:00',
        end_time: '18:00',
      })),
    );
    await fakeProviderSchedulesRepository.replaceByProviderId(luis.id, [
      { day_of_week: 3, start_time: '08:00', end_time: '18:00' },
    ]);

    maria = await newClient('Maria', 'maria@example.test');
    pedro = await newClient('Pedro', 'pedro@example.test');
    // Sem e-mail: só a barbearia pode avisar
    ana = await newClient('Ana');

    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => new Date(2020, 7, 10, 8).getTime());

    // As entradas guardam o client como relação (como no banco)
    const create = fakeWaitlistRepository.create.bind(fakeWaitlistRepository);
    jest
      .spyOn(fakeWaitlistRepository, 'create')
      .mockImplementation(async data => {
        const entry = await create(data);
        entry.client = (await fakeClientsRepository.findById(
          data.client_id,
        )) as Client;
        return entry;
      });
  });

  it('should add clients in order and update a repeated request', async () => {
    await waitlist.add({
      client_id: maria.id,
      date: DAY,
      period: 'afternoon',
      created_by: 'client',
    });
    await waitlist.add({
      client_id: pedro.id,
      date: DAY,
      provider_id: carlos.id,
      notes: 'Pode ser a qualquer hora',
      created_by: 'provider',
      created_by_user: luis.id,
    });
    // Maria pede de novo: só muda a preferência
    await waitlist.add({
      client_id: maria.id,
      date: DAY,
      period: 'morning',
      created_by: 'client',
    });

    const list = await waitlist.listByDate(DAY);

    expect(list.map(item => [item.client?.name, item.period])).toEqual([
      ['Maria', 'morning'],
      ['Pedro', 'any'],
    ]);
    expect(list[1]).toMatchObject({
      created_by: 'provider',
      notes: 'Pode ser a qualquer hora',
      booked: false,
    });
  });

  it('should not add past days or clients already booked that day', async () => {
    await expect(
      waitlist.add({
        client_id: maria.id,
        date: '2020-08-09',
        created_by: 'client',
      }),
    ).rejects.toBeInstanceOf(AppError);

    // 16/08/2020 é domingo: ninguém atende
    await expect(
      waitlist.add({
        client_id: maria.id,
        date: '2020-08-16',
        created_by: 'client',
      }),
    ).rejects.toMatchObject({ message: 'A barbearia não atende neste dia.' });

    // 13/08 é quinta: Luis não atende
    await expect(
      waitlist.add({
        client_id: maria.id,
        date: '2020-08-13',
        provider_id: luis.id,
        created_by: 'client',
      }),
    ).rejects.toMatchObject({ message: 'Este barbeiro não atende neste dia.' });

    await book(maria, carlos, 10);

    await expect(
      waitlist.add({ client_id: maria.id, date: DAY, created_by: 'client' }),
    ).rejects.toMatchObject({
      message: 'Você já tem um horário marcado neste dia.',
    });
  });

  it('should show who already got a time and let clients leave the list', async () => {
    const entry = await waitlist.add({
      client_id: maria.id,
      date: DAY,
      created_by: 'client',
    });

    // A barbearia marcou para ela depois
    await book(maria, luis, 15);

    expect((await waitlist.listByDate(DAY))[0].booked).toBe(true);

    // Outro cliente não tira Maria da lista
    await expect(
      waitlist.remove(entry.id, { id: pedro.id, role: 'client' }),
    ).rejects.toMatchObject({ statusCode: 404 });

    await waitlist.remove(entry.id, { id: maria.id, role: 'client' });

    expect(await waitlist.listByDate(DAY)).toEqual([]);
  });

  it('should warn the barbershop and e-mail the matching clients when a time is freed', async () => {
    const canceled = await book(null, carlos, 15);

    // Tarde com qualquer barbeiro: combina
    await waitlist.add({
      client_id: maria.id,
      date: DAY,
      period: 'afternoon',
      created_by: 'client',
    });
    // Só de manhã: não combina com 15h
    await waitlist.add({
      client_id: pedro.id,
      date: DAY,
      period: 'morning',
      created_by: 'client',
    });
    // Combina, mas sem e-mail: só entra na contagem para a barbearia
    await waitlist.add({
      client_id: ana.id,
      date: DAY,
      provider_id: carlos.id,
      created_by: 'provider',
    });

    await cancelAppointment.execute({
      appointment_id: canceled.id,
      requester: { id: carlos.id, role: 'provider' },
    });

    const notices = fakeClientNotifier.sent.filter(
      item => item.kind === 'waitlist',
    );

    expect(notices).toEqual([expect.objectContaining({ client_id: maria.id })]);
    // Aviso do cancelamento e o da lista de espera
    expect(await fakeNotificationsRepository.countUnread(carlos.id)).toBe(2);
    expect(fakeWaitlistRepository.entries[0].notified_at).toEqual(
      new Date(2020, 7, 10, 8),
    );
  });

  it('should not warn anyone when the freed time does not match', async () => {
    const canceled = await book(null, luis, 10);

    // Só com o Carlos
    await waitlist.add({
      client_id: maria.id,
      date: DAY,
      provider_id: carlos.id,
      created_by: 'client',
    });

    await cancelAppointment.execute({
      appointment_id: canceled.id,
      requester: { id: luis.id, role: 'provider' },
    });

    expect(
      fakeClientNotifier.sent.filter(item => item.kind === 'waitlist'),
    ).toEqual([]);
    expect(await fakeNotificationsRepository.countUnread(luis.id)).toBe(1);
  });
});
