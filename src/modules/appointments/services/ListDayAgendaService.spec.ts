import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import Client from '@modules/clients/infra/typeorm/entities/Client';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import ListDayAgendaService from './ListDayAgendaService';

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
});
