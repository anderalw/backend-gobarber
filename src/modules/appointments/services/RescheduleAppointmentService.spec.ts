import AppError from '@shared/errors/AppError';
import FakeNotificationsRepository from '@modules/notifications/repositories/fakes/FakeNotificationsRepository';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import User from '@modules/users/infra/typeorm/entities/User';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import Appointment from '../infra/typeorm/entities/Appointment';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import RescheduleAppointmentService from './RescheduleAppointmentService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeNotificationsRepository: FakeNotificationsRepository;
let agendaSettings: AgendaSettingsService;
let rescheduleAppointment: RescheduleAppointmentService;
let carlos: User;
let joao: User;
let appointment: Appointment;

const barber = { id: 'any-barber', role: 'provider' as const };
const owner = { id: 'client-id', role: 'client' as const };

describe('RescheduleAppointment', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeNotificationsRepository = new FakeNotificationsRepository();
    const fakeUsersRepository = new FakeUsersRepository();
    const fakeProviderSchedulesRepository = new FakeProviderSchedulesRepository();
    agendaSettings = new AgendaSettingsService(new FakeSettingsRepository());

    rescheduleAppointment = new RescheduleAppointmentService(
      fakeAppointmentsRepository,
      fakeUsersRepository,
      fakeProviderSchedulesRepository,
      agendaSettings,
      fakeNotificationsRepository,
      new FakeCacheProvider(),
    );

    carlos = await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.test',
      password: '123456',
    });
    joao = await fakeUsersRepository.create({
      name: 'João',
      email: 'joao@example.test',
      password: '123456',
    });

    // Os dois atendem de segunda a sábado, das 09:00 às 18:00
    await Promise.all(
      [carlos, joao].map(provider =>
        fakeProviderSchedulesRepository.replaceByProviderId(
          provider.id,
          [1, 2, 3, 4, 5, 6].map(day_of_week => ({
            day_of_week,
            start_time: '09:00',
            end_time: '18:00',
          })),
        ),
      ),
    );

    // Corte de 45 min com o Carlos na terça, 11/08/2020, às 10:00
    appointment = await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: carlos.id,
        client_id: 'client-id',
        date: new Date(2020, 7, 11, 10),
        minutes: 45,
      }),
    );

    // "Agora" é segunda, 10/08/2020 às 12h
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 7, 10, 12).getTime();
    });
  });

  it('should move the appointment keeping its duration', async () => {
    const rescheduled = await rescheduleAppointment.execute({
      appointment_id: appointment.id,
      requester: owner,
      provider_id: carlos.id,
      date: new Date(2020, 7, 12, 14),
    });

    expect(rescheduled).toMatchObject({
      provider_id: carlos.id,
      date: new Date(2020, 7, 12, 14),
      end_date: new Date(2020, 7, 12, 14, 45),
      // Serviço e valor da marcação original
      service_id: 'service-id',
      price_cents: 4500,
    });
  });

  it('should move the appointment to another barber and notify both', async () => {
    const createNotification = jest.spyOn(
      fakeNotificationsRepository,
      'create',
    );

    const rescheduled = await rescheduleAppointment.execute({
      appointment_id: appointment.id,
      requester: barber,
      provider_id: joao.id,
      date: new Date(2020, 7, 11, 10),
    });

    expect(rescheduled.provider_id).toBe(joao.id);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipient_id: joao.id }),
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipient_id: carlos.id }),
    );
  });

  it('should allow moving to a time that overlaps the current one', async () => {
    // 10:00-10:45 para 10:30-11:15: só conflitaria com ele mesmo
    const rescheduled = await rescheduleAppointment.execute({
      appointment_id: appointment.id,
      requester: owner,
      provider_id: carlos.id,
      date: new Date(2020, 7, 11, 10, 30),
    });

    expect(rescheduled.end_date).toEqual(new Date(2020, 7, 11, 11, 15));
  });

  it('should apply the current buffer to the new time', async () => {
    await agendaSettings.update({ buffer_minutes: 15 });

    const rescheduled = await rescheduleAppointment.execute({
      appointment_id: appointment.id,
      requester: owner,
      provider_id: carlos.id,
      date: new Date(2020, 7, 12, 14),
    });

    expect(rescheduled.blocked_until).toEqual(new Date(2020, 7, 12, 15));
  });

  it('should not move to a busy time or outside the working hours', async () => {
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: joao.id,
        client_id: 'other-client',
        date: new Date(2020, 7, 11, 10),
      }),
    );

    // João já está ocupado às 10:00
    await expect(
      rescheduleAppointment.execute({
        appointment_id: appointment.id,
        requester: barber,
        provider_id: joao.id,
        date: new Date(2020, 7, 11, 10, 15),
      }),
    ).rejects.toBeInstanceOf(AppError);

    // 17:30 + 45 min passa das 18:00
    await expect(
      rescheduleAppointment.execute({
        appointment_id: appointment.id,
        requester: barber,
        provider_id: carlos.id,
        date: new Date(2020, 7, 11, 17, 30),
      }),
    ).rejects.toBeInstanceOf(AppError);

    // Passado
    await expect(
      rescheduleAppointment.execute({
        appointment_id: appointment.id,
        requester: barber,
        provider_id: carlos.id,
        date: new Date(2020, 7, 10, 11),
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should require a change and a valid barber', async () => {
    await expect(
      rescheduleAppointment.execute({
        appointment_id: appointment.id,
        requester: barber,
        provider_id: carlos.id,
        date: new Date(2020, 7, 11, 10),
      }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      rescheduleAppointment.execute({
        appointment_id: appointment.id,
        requester: barber,
        provider_id: 'non-existing',
        date: new Date(2020, 7, 12, 10),
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should not let a client move someone else's appointment", async () => {
    await expect(
      rescheduleAppointment.execute({
        appointment_id: appointment.id,
        requester: { id: 'other-client', role: 'client' },
        provider_id: carlos.id,
        date: new Date(2020, 7, 12, 14),
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
