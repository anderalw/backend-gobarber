import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import Client from '@modules/clients/infra/typeorm/entities/Client';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeTimeBlocksRepository from '../repositories/fakes/FakeTimeBlocksRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import ListDayAgendaService from './ListDayAgendaService';
import NoShowPolicyService from './NoShowPolicyService';

let fakeUsersRepository: FakeUsersRepository;
let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeProviderSchedulesRepository: FakeProviderSchedulesRepository;
let listDayAgenda: ListDayAgendaService;

describe('ListDayAgenda', () => {
  beforeEach(() => {
    fakeUsersRepository = new FakeUsersRepository();
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeProviderSchedulesRepository = new FakeProviderSchedulesRepository();
    listDayAgenda = new ListDayAgendaService(
      fakeUsersRepository,
      fakeAppointmentsRepository,
      fakeProviderSchedulesRepository,
      new FakeTimeBlocksRepository(),
      new NoShowPolicyService(
        new FakeSettingsRepository(),
        fakeAppointmentsRepository,
      ),
    );
  });

  it('should list every provider with the schedule of the requested weekday', async () => {
    const joao = await fakeUsersRepository.create({
      name: 'João',
      email: 'joao@example.test',
      password: '123456',
    });
    const carlos = await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.test',
      password: '123456',
    });

    // 20/05/2020 é quarta-feira (3); Carlos não trabalha às quartas
    await fakeProviderSchedulesRepository.replaceByProviderId(joao.id, [
      { day_of_week: 3, start_time: '09:00', end_time: '18:00' },
      { day_of_week: 4, start_time: '13:00', end_time: '20:00' },
    ]);
    await fakeProviderSchedulesRepository.replaceByProviderId(carlos.id, [
      { day_of_week: 5, start_time: '08:00', end_time: '12:00' },
    ]);

    const { providers } = await listDayAgenda.execute({
      day: 20,
      month: 5,
      year: 2020,
    });

    // Ordenados pelo nome
    expect(providers.map(provider => provider.name)).toEqual([
      'Carlos',
      'João',
    ]);
    expect(providers[0].schedule).toBeNull();
    expect(providers[1].schedule).toEqual({
      start_time: '09:00',
      end_time: '18:00',
    });
    expect(providers[1]).not.toHaveProperty('password');
  });

  it('should list the appointments of all providers on that day only', async () => {
    const client = new Client();
    Object.assign(client, {
      id: 'client-id',
      name: 'Maria',
      email: 'maria@example.test',
      phone: '999',
      password: 'hashed-password',
      notes: 'Prefere tesoura',
    });

    const appointmentA = await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: 'provider-a',
        client_id: client.id,
        date: new Date(2020, 4, 20, 15),
      }),
    );
    appointmentA.client = client;

    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: 'provider-b',
        client_id: client.id,
        date: new Date(2020, 4, 20, 9),
      }),
    );

    // Outro dia: não deve aparecer
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: 'provider-a',
        client_id: client.id,
        date: new Date(2020, 4, 21, 9),
      }),
    );

    const { appointments } = await listDayAgenda.execute({
      day: 20,
      month: 5,
      year: 2020,
    });

    expect(appointments).toHaveLength(2);
    // Ordenados pelo horário
    expect(appointments.map(item => item.provider_id)).toEqual([
      'provider-b',
      'provider-a',
    ]);
    // Só os dados do cliente que a agenda precisa, sem a senha
    expect(appointments[1].client).toEqual({
      id: 'client-id',
      name: 'Maria',
      email: 'maria@example.test',
      phone: '999',
      notes: 'Prefere tesoura',
      completed: 0,
      no_shows: 0,
      last_visit: null,
      no_show_alert: false,
    });
    // Data em que a marcação foi feita, para os detalhes do agendamento
    expect(appointments[1].created_at).toBe(appointmentA.created_at);
    // Fim do atendimento e valor, para o tamanho do card e os detalhes
    expect(appointments[1]).toMatchObject({
      end_date: appointmentA.end_date,
      blocked_until: appointmentA.blocked_until,
      price_cents: 4500,
      // Serviço não carregado (ex: agendamento anterior aos serviços)
      service: null,
    });
    // Agendamento sem cliente carregado (ex: cliente removido)
    expect(appointments[0].client).toBeNull();
  });

  it('should hide deactivated providers unless they have appointments that day', async () => {
    const ana = await fakeUsersRepository.create({
      name: 'Ana',
      email: 'ana@example.test',
      password: '123456',
    });
    ana.active = false;
    const bia = await fakeUsersRepository.create({
      name: 'Bia',
      email: 'bia@example.test',
      password: '123456',
    });
    bia.active = false;

    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: bia.id,
        client_id: 'client-id',
        date: new Date(2020, 4, 20, 10),
      }),
    );

    const { providers } = await listDayAgenda.execute({
      day: 20,
      month: 5,
      year: 2020,
    });

    expect(providers.map(provider => [provider.name, provider.active])).toEqual(
      [['Bia', false]],
    );
  });

  it('should flag clients who missed appointments recently', async () => {
    jest
      .spyOn(Date, 'now')
      .mockImplementation(() => new Date(2020, 4, 20, 8).getTime());

    const client = Object.assign(new Client(), {
      id: 'client-id',
      name: 'Maria',
      phone: '999',
    });

    // Duas faltas nos últimos 12 meses e um atendimento concluído
    const past = [
      [new Date(2020, 1, 10, 9), 'no_show'],
      [new Date(2020, 2, 10, 9), 'no_show'],
      [new Date(2020, 3, 10, 9), 'completed'],
    ] as const;

    await Promise.all(
      past.map(async ([date, attendance]) => {
        const appointment = await fakeAppointmentsRepository.create(
          makeAppointmentData({
            provider_id: 'provider-a',
            client_id: client.id,
            date,
          }),
        );
        appointment.attendance = attendance;
      }),
    );

    const today = await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: 'provider-a',
        client_id: client.id,
        date: new Date(2020, 4, 20, 15),
      }),
    );
    today.client = client;

    const { appointments } = await listDayAgenda.execute({
      day: 20,
      month: 5,
      year: 2020,
    });

    expect(appointments[0].client).toMatchObject({
      completed: 1,
      no_shows: 2,
      last_visit: new Date(2020, 3, 10, 9),
      // Padrão: alerta a partir de 2 faltas
      no_show_alert: true,
    });
  });
});
