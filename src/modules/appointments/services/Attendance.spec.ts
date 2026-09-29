import AppError from '@shared/errors/AppError';
import User from '@modules/users/infra/typeorm/entities/User';
import Service from '@modules/catalog/infra/typeorm/entities/Service';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import Appointment from '../infra/typeorm/entities/Appointment';
import SetAttendanceService from './SetAttendanceService';
import RevenueReportService from './RevenueReportService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let setAttendance: SetAttendanceService;
let revenueReport: RevenueReportService;

// Setembro de 2026; "agora" é 29/09 às 12:00
const at = (day: number, hours: number): Date => new Date(2026, 8, day, hours);

async function book(
  provider: string,
  day: number,
  hours: number,
  price: number,
  serviceName = 'Cabelo',
): Promise<Appointment> {
  const appointment = await fakeAppointmentsRepository.create({
    ...makeAppointmentData({
      provider_id: provider,
      client_id: 'client',
      date: at(day, hours),
    }),
    price_cents: price,
    service_id: serviceName,
  });

  // No banco, as relações vêm carregadas pelo findAllInPeriod
  appointment.provider = Object.assign(new User(), {
    id: provider,
    name: provider === 'joao' ? 'João' : 'Carlos',
  });
  appointment.service = Object.assign(new Service(), {
    id: serviceName,
    name: serviceName,
  });

  return appointment;
}

describe('Situação do atendimento', () => {
  beforeEach(() => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    setAttendance = new SetAttendanceService(fakeAppointmentsRepository);
    revenueReport = new RevenueReportService(fakeAppointmentsRepository);

    jest.spyOn(Date, 'now').mockImplementation(() => at(29, 12).getTime());
  });

  it('should mark an appointment that already started as completed', async () => {
    const appointment = await book('joao', 29, 10, 4500);

    const updated = await setAttendance.execute({
      appointment_id: appointment.id,
      attendance: 'completed',
      requester_id: 'joao',
    });

    expect(updated).toMatchObject({
      attendance: 'completed',
      attendance_by: 'joao',
      attendance_at: at(29, 12),
    });
  });

  it('should undo the attendance', async () => {
    const appointment = await book('joao', 29, 10, 4500);

    await setAttendance.execute({
      appointment_id: appointment.id,
      attendance: 'no_show',
      requester_id: 'joao',
    });
    const undone = await setAttendance.execute({
      appointment_id: appointment.id,
      attendance: null,
      requester_id: 'joao',
    });

    expect(undone).toMatchObject({
      attendance: null,
      attendance_by: null,
      attendance_at: null,
    });
  });

  it('should not mark before the appointment starts', async () => {
    const appointment = await book('joao', 29, 15, 4500);

    await expect(
      setAttendance.execute({
        appointment_id: appointment.id,
        attendance: 'completed',
        requester_id: 'joao',
      }),
    ).rejects.toMatchObject({
      message:
        'Só é possível registrar a situação depois que o horário começa.',
    });
  });

  it('should not mark a canceled or unknown appointment', async () => {
    const appointment = await book('joao', 29, 10, 4500);
    appointment.canceled_at = at(28, 9);

    await expect(
      setAttendance.execute({
        appointment_id: appointment.id,
        attendance: 'completed',
        requester_id: 'joao',
      }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      setAttendance.execute({
        appointment_id: 'unknown',
        attendance: 'completed',
        requester_id: 'joao',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  describe('faturamento', () => {
    const mark = (
      appointment: Appointment,
      attendance: 'completed' | 'no_show',
    ) =>
      setAttendance.execute({
        appointment_id: appointment.id,
        attendance,
        requester_id: 'joao',
      });

    it('should sum completed appointments and split the rest', async () => {
      await mark(await book('joao', 28, 9, 4500), 'completed');
      await mark(await book('joao', 28, 10, 3000, 'Barba'), 'completed');
      await mark(await book('carlos', 28, 9, 4500), 'completed');
      await mark(await book('carlos', 28, 11, 4500), 'no_show');
      // A confirmar (já passou, sem registro) e futuro
      await book('joao', 29, 9, 4500);
      await book('carlos', 30, 9, 4500);
      // Cancelado: só conta como cancelado
      const canceled = await book('joao', 30, 10, 4500);
      canceled.canceled_at = at(29, 8);
      // Fora do período
      await mark(await book('joao', 1, 9, 9900), 'completed');

      const report = await revenueReport.execute({
        start: '2026-09-28',
        end: '2026-09-30',
      });

      expect(report.totals).toEqual({
        completed: 3,
        no_show: 1,
        pending: 1,
        upcoming: 1,
        canceled: 1,
        revenue_cents: 12000,
        expected_cents: 21000,
        lost_cents: 4500,
        average_ticket_cents: 4000,
      });
      expect(
        report.providers.map(({ name, revenue_cents, completed, no_show }) => [
          name,
          revenue_cents,
          completed,
          no_show,
        ]),
      ).toEqual([
        ['João', 7500, 2, 0],
        ['Carlos', 4500, 1, 1],
      ]);
      expect(report.services).toEqual([
        { id: 'Cabelo', name: 'Cabelo', completed: 2, revenue_cents: 9000 },
        { id: 'Barba', name: 'Barba', completed: 1, revenue_cents: 3000 },
      ]);
      expect(report.days).toEqual([
        { date: '2026-09-28', completed: 3, revenue_cents: 12000 },
        { date: '2026-09-29', completed: 0, revenue_cents: 0 },
        { date: '2026-09-30', completed: 0, revenue_cents: 0 },
      ]);
    });

    it('should reject an invalid or too long period', async () => {
      await expect(
        revenueReport.execute({ start: '2026-09-30', end: '2026-09-01' }),
      ).rejects.toBeInstanceOf(AppError);
      await expect(
        revenueReport.execute({ start: '2025-01-01', end: '2026-09-01' }),
      ).rejects.toBeInstanceOf(AppError);
    });
  });
});
