import AppError from '@shared/errors/AppError';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeClientsRepository from '@modules/clients/repositories/fakes/FakeClientsRepository';
import User from '@modules/users/infra/typeorm/entities/User';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeTimeBlocksRepository from '../repositories/fakes/FakeTimeBlocksRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import { Attendance } from '../infra/typeorm/entities/Appointment';
import InsightsService from './InsightsService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeTimeBlocksRepository: FakeTimeBlocksRepository;
let fakeClientsRepository: FakeClientsRepository;
let insights: InsightsService;
let carlos: User;

// Segunda, 28/09/2026 (período atual) e a anterior, 21/09
const on = (day: number, hours: number, month = 9): Date =>
  new Date(2026, month - 1, day, hours);

async function book(
  client_id: string,
  date: Date,
  attendance: Attendance | null = null,
  { canceled = false, paid = null as number | null } = {},
) {
  const appointment = await fakeAppointmentsRepository.create(
    makeAppointmentData({ provider_id: carlos.id, client_id, date }),
  );

  appointment.attendance = attendance;
  appointment.paid_cents = paid;
  if (canceled) appointment.canceled_at = date;

  return appointment;
}

describe('Indicadores', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeTimeBlocksRepository = new FakeTimeBlocksRepository();
    fakeClientsRepository = new FakeClientsRepository();
    const fakeUsersRepository = new FakeUsersRepository();
    const fakeProviderSchedulesRepository =
      new FakeProviderSchedulesRepository();

    insights = new InsightsService(
      fakeAppointmentsRepository,
      fakeUsersRepository,
      fakeProviderSchedulesRepository,
      fakeTimeBlocksRepository,
      fakeClientsRepository,
    );

    carlos = await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.test',
      password: '123456',
    });

    // Só às segundas, das 09:00 às 17:00 (480 minutos)
    await fakeProviderSchedulesRepository.replaceByProviderId(carlos.id, [
      { day_of_week: 1, start_time: '09:00', end_time: '17:00' },
    ]);

    jest.spyOn(Date, 'now').mockImplementation(() => on(29, 12).getTime());
  });

  it('should compare the period with the previous one', async () => {
    // Período anterior (o dia de antes, do mesmo tamanho): 1 atendido e
    // 1 falta
    await book('antigo', on(27, 9), 'completed');
    await book('antigo', on(27, 10), 'no_show');

    // Período: 2 atendidos (um com desconto), 1 falta, 1 cancelado
    await book('antigo', on(28, 9), 'completed', { paid: 4000 });
    await book('novo', on(28, 10), 'completed');
    await book('novo', on(28, 11), 'no_show');
    await book('outro', on(28, 14), null, { canceled: true });

    const result = await insights.execute({
      start: '2026-09-28',
      end: '2026-09-28',
    });

    expect(result.current).toMatchObject({
      total: 4,
      completed: 2,
      no_show: 1,
      canceled: 1,
      revenue_cents: 8500,
      average_ticket_cents: 4250,
      no_show_rate: 1 / 3,
      cancel_rate: 1 / 4,
      active_clients: 2,
      // "antigo" já tinha vindo antes
      new_clients: 1,
    });
    expect(result.previous).toMatchObject({
      completed: 1,
      no_show: 1,
      no_show_rate: 0.5,
      new_clients: 1,
    });
  });

  it('should measure the occupancy without the blocked time', async () => {
    // Almoço das 12h às 13h: sobram 420 minutos
    await fakeTimeBlocksRepository.create({
      provider_id: carlos.id,
      start_date: on(28, 12),
      end_date: on(28, 13),
      reason: 'Almoço',
      created_by: null,
    });

    // Três horas marcadas (o cancelado não conta)
    await book('a', on(28, 9), 'completed');
    await book('b', on(28, 10));
    await book('c', on(28, 14));
    await book('d', on(28, 15), null, { canceled: true });

    const result = await insights.execute({
      start: '2026-09-28',
      end: '2026-09-28',
    });

    expect(result.current.occupancy).toEqual({
      booked_minutes: 180,
      available_minutes: 420,
      rate: 180 / 420,
    });
    expect(result.providers).toEqual([
      expect.objectContaining({ name: 'Carlos', rate: 180 / 420 }),
    ]);
    // O dia anterior é domingo: sem expediente, sem ocupação
    expect(result.previous.occupancy.rate).toBeNull();
  });

  it('should count the busiest hours and services', async () => {
    await book('a', on(28, 9));
    await book('b', on(28, 10));
    await book('c', on(21, 10, 9));

    const result = await insights.execute({
      start: '2026-09-21',
      end: '2026-09-28',
    });

    // Das 9h às 16h (último horário que começa antes das 17h)
    expect(result.heatmap.hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    // Segundas: um às 9h e dois às 10h
    expect(result.heatmap.days[1].slice(0, 2)).toEqual([1, 2]);
    expect(result.services).toEqual([expect.objectContaining({ count: 3 })]);
  });

  it('should list clients who stopped coming', async () => {
    const [sumiu, voltou, novo] = await Promise.all(
      ['Rafael', 'Bruno', 'Pedro'].map(name =>
        fakeClientsRepository.create({
          name,
          email: null,
          password: null,
          phone: '11999990000',
        }),
      ),
    );

    // Rafael veio 3 vezes, a última em julho
    await book(sumiu.id, on(1, 10, 6), 'completed');
    await book(sumiu.id, on(1, 10, 7), 'completed');
    await book(sumiu.id, on(20, 10, 7), 'completed');
    // Bruno sumiu também, mas já tem horário marcado
    await book(voltou.id, on(1, 10, 7), 'completed');
    await book(voltou.id, on(5, 10, 10));
    // Pedro veio semana passada
    await book(novo.id, on(21, 10), 'completed');

    const lost = await insights.lostClients(45);

    expect(lost).toEqual([
      expect.objectContaining({
        name: 'Rafael',
        visits: 3,
        last_visit: on(20, 10, 7),
        days_away: 71,
      }),
    ]);

    await expect(insights.lostClients(3)).rejects.toBeInstanceOf(AppError);
  });
});
