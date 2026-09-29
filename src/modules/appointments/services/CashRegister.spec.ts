import AppError from '@shared/errors/AppError';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeCashClosingsRepository from '../repositories/fakes/FakeCashClosingsRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import Appointment, {
  PaymentMethod,
} from '../infra/typeorm/entities/Appointment';
import CashRegisterService from './CashRegisterService';
import SetAttendanceService from './SetAttendanceService';
import SetPaymentService from './SetPaymentService';
import RevenueReportService from './RevenueReportService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let cash: CashRegisterService;
let setAttendance: SetAttendanceService;
let setPayment: SetPaymentService;
let barberId: string;

// "Agora" é 29/09/2026 às 19h; os atendimentos são do mesmo dia
const at = (hours: number, day = 29): Date => new Date(2026, 8, day, hours);
const DAY = '2026-09-29';

async function done(
  hours: number,
  payment_method: PaymentMethod | null,
  paid_cents: number | null = null,
): Promise<Appointment> {
  const appointment = await fakeAppointmentsRepository.create(
    makeAppointmentData({
      provider_id: barberId,
      client_id: 'client',
      date: at(hours),
    }),
  );

  return setAttendance.execute({
    appointment_id: appointment.id,
    attendance: 'completed',
    requester_id: barberId,
    payment_method,
    paid_cents,
  });
}

describe('Caixa', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    const fakeUsersRepository = new FakeUsersRepository();

    cash = new CashRegisterService(
      fakeAppointmentsRepository,
      new FakeCashClosingsRepository(),
      fakeUsersRepository,
    );
    setAttendance = new SetAttendanceService(fakeAppointmentsRepository);
    setPayment = new SetPaymentService(fakeAppointmentsRepository);

    barberId = (
      await fakeUsersRepository.create({
        name: 'Carlos',
        email: 'carlos@example.test',
        password: '123456',
      })
    ).id;

    jest.spyOn(Date, 'now').mockImplementation(() => at(19).getTime());
  });

  it('should total the day by payment method', async () => {
    // Preço de 45,00 em todos (makeAppointmentData)
    await done(9, 'pix');
    await done(10, 'cash', 4000); // desconto
    await done(11, 'cash');
    await done(12, 'credit', 5000); // gorjeta no cartão
    await done(13, null);

    // Faltou e ainda não registrado: não entram no caixa
    const missed = await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: barberId,
        client_id: 'c',
        date: at(14),
      }),
    );
    missed.attendance = 'no_show';
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: barberId,
        client_id: 'c',
        date: at(15),
      }),
    );
    // Outro dia: fora
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: barberId,
        client_id: 'c',
        date: at(10, 28),
      }),
    );

    const report = await cash.show(DAY);

    expect(report.received_cents).toBe(4500 + 4000 + 4500 + 5000 + 4500);
    expect(report.totals).toEqual({
      pix: { count: 1, cents: 4500 },
      credit: { count: 1, cents: 5000 },
      debit: { count: 0, cents: 0 },
      cash: { count: 2, cents: 8500 },
      unknown: { count: 1, cents: 4500 },
    });
    expect(report.items).toHaveLength(5);
    expect(report.pending).toBe(1);
    expect(report.no_show).toBe(1);
    expect(report.closing).toBeNull();
  });

  it('should close the day comparing the counted cash', async () => {
    await done(9, 'cash');
    await done(10, 'pix');

    const report = await cash.close({
      date: DAY,
      opening_cents: 10000,
      counted_cents: 14000,
      notes: ' Faltou troco ',
      user_id: barberId,
    });

    expect(report.closing).toMatchObject({
      opening_cents: 10000,
      // Fundo de troco + 45,00 em dinheiro
      expected_cash_cents: 14500,
      difference_cents: -500,
      received_cents: 9000,
      notes: 'Faltou troco',
      closed_by: { id: barberId, name: 'Carlos' },
      outdated: false,
    });

    // Um atendimento registrado depois do fechamento
    await done(11, 'cash');

    expect((await cash.show(DAY)).closing?.outdated).toBe(true);

    // Refazer o fechamento substitui o anterior
    const again = await cash.close({
      date: DAY,
      opening_cents: 10000,
      counted_cents: 19000,
      user_id: barberId,
    });

    expect(again.closing).toMatchObject({
      difference_cents: 0,
      outdated: false,
    });
  });

  it('should not close a future day', async () => {
    await expect(
      cash.close({
        date: '2026-09-30',
        opening_cents: 0,
        counted_cents: 0,
        user_id: barberId,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should complete the payment later, only for completed appointments', async () => {
    const appointment = await done(9, null);

    await setPayment.execute({
      appointment_id: appointment.id,
      payment_method: 'debit',
      paid_cents: 3000,
    });

    expect((await cash.show(DAY)).totals.debit).toEqual({
      count: 1,
      cents: 3000,
    });

    const upcoming = await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: barberId,
        client_id: 'c',
        date: at(20),
      }),
    );

    await expect(
      setPayment.execute({
        appointment_id: upcoming.id,
        payment_method: 'pix',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should clear the payment when the attendance changes', async () => {
    const appointment = await done(9, 'pix', 4000);

    const changed = await setAttendance.execute({
      appointment_id: appointment.id,
      attendance: 'no_show',
      requester_id: barberId,
      payment_method: 'pix',
    });

    expect(changed).toMatchObject({ payment_method: null, paid_cents: null });
  });

  it('should use the received value in the revenue report', async () => {
    await done(9, 'pix', 4000);
    await done(10, null);

    const report = await new RevenueReportService(
      fakeAppointmentsRepository,
    ).execute({ start: DAY, end: DAY });

    expect(report.totals.revenue_cents).toBe(8500);
    expect(report.methods.pix).toEqual({ count: 1, cents: 4000 });
    expect(report.methods.unknown).toEqual({ count: 1, cents: 4500 });
  });
});
