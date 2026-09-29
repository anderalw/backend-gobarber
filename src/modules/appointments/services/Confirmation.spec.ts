import AppError from '@shared/errors/AppError';
import Client from '@modules/clients/infra/typeorm/entities/Client';
import FakeNotificationsRepository from '@modules/notifications/repositories/fakes/FakeNotificationsRepository';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeClientNotifier from '../notifier/FakeClientNotifier';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import Appointment from '../infra/typeorm/entities/Appointment';
import SendConfirmationRequestsService from './SendConfirmationRequestsService';
import ConfirmAppointmentService from './ConfirmAppointmentService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeNotificationsRepository: FakeNotificationsRepository;
let fakeClientNotifier: FakeClientNotifier;
let sendRequests: SendConfirmationRequestsService;
let confirmAppointment: ConfirmAppointmentService;

// "Agora" é 29/09/2026 às 12:00
const at = (day: number, hours: number): Date => new Date(2026, 8, day, hours);

async function book(
  day: number,
  hours: number,
  { createdAt = at(20, 9), email = 'cliente@example.test' } = {},
): Promise<Appointment> {
  const appointment = await fakeAppointmentsRepository.create(
    makeAppointmentData({
      provider_id: 'joao',
      client_id: 'client',
      date: at(day, hours),
    }),
  );

  appointment.created_at = createdAt;
  appointment.client = Object.assign(new Client(), {
    id: 'client',
    name: 'Rafael Souza',
    email,
  });

  return appointment;
}

// Link enviado no último pedido de confirmação
const lastToken = (): string =>
  (
    fakeClientNotifier.sent.filter(item => item.kind === 'confirmation').pop()
      ?.link || ''
  ).split('token=')[1];

describe('Confirmação pelo cliente', () => {
  beforeEach(() => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeNotificationsRepository = new FakeNotificationsRepository();
    fakeClientNotifier = new FakeClientNotifier();
    sendRequests = new SendConfirmationRequestsService(
      fakeAppointmentsRepository,
      fakeClientNotifier,
    );
    confirmAppointment = new ConfirmAppointmentService(
      fakeAppointmentsRepository,
      fakeNotificationsRepository,
    );

    process.env.APP_WEB_URL = 'http://gobarber.test';
    jest.spyOn(Date, 'now').mockImplementation(() => at(29, 12).getTime());
  });

  it('should ask for confirmation of appointments in the next 24 hours, once', async () => {
    const tomorrow = await book(30, 10);
    // Mais de 24 horas: ainda não
    await book(30, 14);

    expect(await sendRequests.execute()).toBe(1);
    expect(await sendRequests.execute()).toBe(0);

    expect(fakeClientNotifier.sent).toEqual([
      expect.objectContaining({
        kind: 'confirmation',
        appointment_id: tomorrow.id,
        link: expect.stringMatching(
          /^http:\/\/gobarber\.test\/confirmar-agendamento\?token=[0-9a-f]{48}$/,
        ),
      }),
    ]);
  });

  it('should skip clients without e-mail and appointments booked at the last minute', async () => {
    await book(30, 9, { email: '' });
    // Marcado 4 horas antes do horário
    await book(29, 16, { createdAt: at(29, 12) });

    expect(await sendRequests.execute()).toBe(0);
  });

  it('should confirm with the link and notify the provider', async () => {
    const appointment = await book(30, 10);
    await sendRequests.execute();

    const result = await confirmAppointment.execute(lastToken());

    expect(result).toMatchObject({
      confirmed_now: true,
      appointment: { client_name: 'Rafael Souza' },
    });
    expect(appointment.confirmed_at).toEqual(at(29, 12));
    expect(await fakeNotificationsRepository.countUnread('joao')).toBe(1);

    // Abrir o link de novo não confirma nem avisa outra vez
    const again = await confirmAppointment.execute(lastToken());

    expect(again.confirmed_now).toBe(false);
    expect(await fakeNotificationsRepository.countUnread('joao')).toBe(1);
  });

  it('should reject an unknown link, a canceled or a past appointment', async () => {
    await expect(
      confirmAppointment.execute('x'.repeat(48)),
    ).rejects.toMatchObject({ statusCode: 404 });

    const canceled = await book(30, 10);
    await sendRequests.execute();
    canceled.canceled_at = at(29, 11);

    await expect(
      confirmAppointment.execute(lastToken()),
    ).rejects.toBeInstanceOf(AppError);

    const soon = await book(29, 20);
    await sendRequests.execute();
    jest.spyOn(Date, 'now').mockImplementation(() => at(29, 21).getTime());

    expect(soon.confirmation_token).toBeTruthy();
    await expect(
      confirmAppointment.execute(soon.confirmation_token as string),
    ).rejects.toMatchObject({ message: 'Este horário já passou.' });
  });
});
