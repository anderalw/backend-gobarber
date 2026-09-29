import AppError from '@shared/errors/AppError';
import FakeNotificationsRepository from '@modules/notifications/repositories/fakes/FakeNotificationsRepository';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import NotifyWaitlistService from './NotifyWaitlistService';
import FakeWaitlistRepository from '../repositories/fakes/FakeWaitlistRepository';
import Appointment from '../infra/typeorm/entities/Appointment';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeClientNotifier from '../notifier/FakeClientNotifier';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import CancelAppointmentService from './CancelAppointmentService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeNotificationsRepository: FakeNotificationsRepository;
let cancelAppointment: CancelAppointmentService;
let appointment: Appointment;

const barber = { id: 'provider-id', role: 'provider' as const };
const owner = { id: 'client-id', role: 'client' as const };

describe('CancelAppointment', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeNotificationsRepository = new FakeNotificationsRepository();
    cancelAppointment = new CancelAppointmentService(
      fakeAppointmentsRepository,
      fakeNotificationsRepository,
      new FakeCacheProvider(),
      new FakeClientNotifier(),
      new NotifyWaitlistService(
        new FakeWaitlistRepository(),
        fakeAppointmentsRepository,
        fakeNotificationsRepository,
        new FakeClientNotifier(),
      ),
    );

    // Agendamento às 15h; "agora" é 10h do mesmo dia
    appointment = await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: 'provider-id',
        client_id: 'client-id',
        date: new Date(2020, 7, 10, 15),
      }),
    );

    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 7, 10, 10).getTime();
    });
  });

  it('should cancel without deleting and free the time', async () => {
    const createNotification = jest.spyOn(
      fakeNotificationsRepository,
      'create',
    );

    const canceled = await cancelAppointment.execute({
      appointment_id: appointment.id,
      requester: owner,
    });

    expect(canceled.canceled_at).toEqual(new Date(2020, 7, 10, 10));
    expect(canceled.canceled_by).toBe('client');
    expect(await fakeAppointmentsRepository.findById(appointment.id)).toBe(
      canceled,
    );

    // O horário fica livre para outro agendamento
    expect(
      await fakeAppointmentsRepository.findOverlapping({
        provider_id: 'provider-id',
        start: new Date(2020, 7, 10, 15),
        end: new Date(2020, 7, 10, 16),
      }),
    ).toBeUndefined();

    // O barbeiro é avisado
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipient_id: 'provider-id' }),
    );
  });

  it('should let a barber cancel any appointment', async () => {
    const canceled = await cancelAppointment.execute({
      appointment_id: appointment.id,
      requester: barber,
    });

    expect(canceled.canceled_by).toBe('provider');
  });

  it("should not let a client cancel someone else's appointment", async () => {
    await expect(
      cancelAppointment.execute({
        appointment_id: appointment.id,
        requester: { id: 'other-client', role: 'client' },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should require 2 hours of notice from the client, but not from the barber', async () => {
    // 13:30: faltam 1h30
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 7, 10, 13, 30).getTime();
    });

    await expect(
      cancelAppointment.execute({
        appointment_id: appointment.id,
        requester: owner,
      }),
    ).rejects.toBeInstanceOf(AppError);

    const canceled = await cancelAppointment.execute({
      appointment_id: appointment.id,
      requester: barber,
    });

    expect(canceled.canceled_at).toBeTruthy();
  });

  it('should not cancel an appointment that already started or was canceled', async () => {
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 7, 10, 15, 10).getTime();
    });

    await expect(
      cancelAppointment.execute({
        appointment_id: appointment.id,
        requester: barber,
      }),
    ).rejects.toBeInstanceOf(AppError);

    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 7, 10, 10).getTime();
    });

    await cancelAppointment.execute({
      appointment_id: appointment.id,
      requester: barber,
    });

    await expect(
      cancelAppointment.execute({
        appointment_id: appointment.id,
        requester: barber,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should not cancel a non-existing appointment', async () => {
    await expect(
      cancelAppointment.execute({
        appointment_id: 'non-existing',
        requester: barber,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
