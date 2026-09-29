import AppError from '@shared/errors/AppError';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import FakeAppointmentsRepository from '@modules/appointments/repositories/fakes/FakeAppointmentsRepository';
import makeAppointmentData from '@modules/appointments/repositories/fakes/makeAppointmentData';
import NoShowPolicyService from '@modules/appointments/services/NoShowPolicyService';
import { Attendance } from '@modules/appointments/infra/typeorm/entities/Appointment';
import FakeClientsRepository from '../repositories/fakes/FakeClientsRepository';
import Client from '../infra/typeorm/entities/Client';
import ListClientsService from './ListClientsService';
import ShowClientService from './ShowClientService';
import UpdateClientService from './UpdateClientService';

let fakeClientsRepository: FakeClientsRepository;
let fakeAppointmentsRepository: FakeAppointmentsRepository;
let noShowPolicy: NoShowPolicyService;
let listClients: ListClientsService;
let showClient: ShowClientService;
let updateClient: UpdateClientService;

// "Agora" é 29/09/2026 às 12:00
const at = (month: number, day: number, hours = 10): Date =>
  new Date(2026, month - 1, day, hours);

async function newClient(name: string, password: string | null = null) {
  return fakeClientsRepository.create({
    name,
    email: `${name.toLowerCase()}@example.test`,
    phone: '11999990000',
    password,
  });
}

async function visit(
  client: Client,
  date: Date,
  attendance: Attendance | null = null,
  { canceled = false, price = 4500 } = {},
) {
  const appointment = await fakeAppointmentsRepository.create({
    ...makeAppointmentData({ provider_id: 'joao', client_id: client.id, date }),
    price_cents: price,
  });

  appointment.attendance = attendance;
  if (canceled) appointment.canceled_at = date;

  return appointment;
}

describe('Ficha do cliente', () => {
  beforeEach(() => {
    fakeClientsRepository = new FakeClientsRepository();
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    noShowPolicy = new NoShowPolicyService(
      new FakeSettingsRepository(),
      fakeAppointmentsRepository,
    );
    listClients = new ListClientsService(
      fakeClientsRepository,
      fakeAppointmentsRepository,
      noShowPolicy,
    );
    showClient = new ShowClientService(
      fakeClientsRepository,
      fakeAppointmentsRepository,
      noShowPolicy,
    );
    updateClient = new UpdateClientService(fakeClientsRepository);

    jest.spyOn(Date, 'now').mockImplementation(() => at(9, 29, 12).getTime());
  });

  it('should summarize the history of each client', async () => {
    const rafael = await newClient('Rafael');
    await newClient('Bruno');

    await visit(rafael, at(8, 1), 'completed', { price: 4500 });
    await visit(rafael, at(9, 1), 'completed', { price: 6000 });
    await visit(rafael, at(9, 10), 'no_show');
    await visit(rafael, at(9, 15), null, { canceled: true });
    await visit(rafael, at(10, 5));

    const { clients, total } = await listClients.execute({});

    expect(total).toBe(2);
    // Em ordem de nome; quem nunca veio aparece zerado
    expect(clients.map(client => client.name)).toEqual(['Bruno', 'Rafael']);
    expect(clients[0].summary).toMatchObject({ completed: 0, total_cents: 0 });
    expect(clients[1].summary).toEqual({
      completed: 2,
      no_shows: 1,
      recent_no_shows: 1,
      canceled: 1,
      total_cents: 10500,
      last_visit: at(9, 1),
      next_appointment: at(10, 5),
    });
    // Uma falta não passa do limite padrão (2)
    expect(clients[1].no_show_alert).toBe(false);
  });

  it('should search and paginate the client list', async () => {
    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        newClient(`Cliente ${String(index).padStart(2, '0')}`),
      ),
    );
    await newClient('Rafael');

    const second = await listClients.execute({ page: 2 });

    expect(second.total).toBe(26);
    expect(second.clients).toHaveLength(6);

    const found = await listClients.execute({ search: 'rafa' });

    expect(found.clients.map(client => client.name)).toEqual(['Rafael']);
  });

  it('should show the full history, newest first', async () => {
    const rafael = await newClient('Rafael');
    await visit(rafael, at(8, 1), 'completed');
    await visit(rafael, at(9, 15), null, { canceled: true });

    const profile = await showClient.execute(rafael.id);

    expect(profile.appointments.map(item => item.date)).toEqual([
      at(9, 15),
      at(8, 1),
    ]);
    expect(profile.has_account).toBe(false);

    await expect(showClient.execute('nope')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('should update contacts and notes', async () => {
    const rafael = await newClient('Rafael');

    const updated = await updateClient.execute({
      client_id: rafael.id,
      name: ' Rafael Souza ',
      phone: '11988887777',
      email: '',
      notes: '  Máquina 2 nas laterais  ',
    });

    expect(updated).toMatchObject({
      name: 'Rafael Souza',
      email: null,
      notes: 'Máquina 2 nas laterais',
    });
  });

  it('should not update to an e-mail in use or remove the login e-mail', async () => {
    const rafael = await newClient('Rafael', 'hashed');
    await newClient('Bruno');

    await expect(
      updateClient.execute({
        client_id: rafael.id,
        name: 'Rafael',
        phone: '1',
        email: 'bruno@example.test',
      }),
    ).rejects.toBeInstanceOf(AppError);

    // Quem tem conta entra com o e-mail
    await expect(
      updateClient.execute({
        client_id: rafael.id,
        name: 'Rafael',
        phone: '1',
        email: null,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('Política de faltas', () => {
  beforeEach(() => {
    fakeClientsRepository = new FakeClientsRepository();
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    noShowPolicy = new NoShowPolicyService(
      new FakeSettingsRepository(),
      fakeAppointmentsRepository,
    );

    jest.spyOn(Date, 'now').mockImplementation(() => at(9, 29, 12).getTime());
  });

  it('should alert from 2 no-shows by default, without blocking the site', async () => {
    expect(await noShowPolicy.get()).toEqual({
      alert_threshold: 2,
      block_online: false,
    });
  });

  it('should block online booking for clients with recent no-shows', async () => {
    const rafael = await newClient('Rafael');
    const bruno = await newClient('Bruno');

    await visit(rafael, at(7, 1), 'no_show');
    await visit(rafael, at(8, 1), 'no_show');
    // Uma falta antiga, seguida de 10 atendimentos, já não conta
    await visit(bruno, at(1, 5), 'no_show');
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        visit(bruno, at(2 + Math.floor(index / 2), 1 + index), 'completed'),
      ),
    );
    await visit(bruno, at(8, 1), 'no_show');

    // Sem bloqueio: todos agendam
    await expect(
      noShowPolicy.ensureCanBookOnline(rafael.id),
    ).resolves.toBeUndefined();

    await noShowPolicy.update({ alert_threshold: 2, block_online: true });

    await expect(
      noShowPolicy.ensureCanBookOnline(rafael.id),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      noShowPolicy.ensureCanBookOnline(bruno.id),
    ).resolves.toBeUndefined();
  });

  it('should turn off the alert (and the block) with 0', async () => {
    const policy = await noShowPolicy.update({
      alert_threshold: 0,
      block_online: true,
    });

    expect(policy).toEqual({ alert_threshold: 0, block_online: false });

    await expect(
      noShowPolicy.update({ alert_threshold: 11, block_online: false }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
