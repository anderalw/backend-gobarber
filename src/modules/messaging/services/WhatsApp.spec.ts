import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import FakeStorageProvider from '@shared/container/providers/StorageProvider/fakes/FakeStorageProvider';
import BrandingService from '@modules/catalog/services/BrandingService';
import Client from '@modules/clients/infra/typeorm/entities/Client';
import Appointment from '@modules/appointments/infra/typeorm/entities/Appointment';
import FakeAppointmentsRepository from '@modules/appointments/repositories/fakes/FakeAppointmentsRepository';
import makeAppointmentData from '@modules/appointments/repositories/fakes/makeAppointmentData';
import SendConfirmationRequestsService from '@modules/appointments/services/SendConfirmationRequestsService';
import FakeMembershipPlansRepository from '@modules/memberships/repositories/fakes/FakeMembershipPlansRepository';
import FakeMembershipsRepository from '@modules/memberships/repositories/fakes/FakeMembershipsRepository';
import FakeWhatsAppMessagesRepository from '../repositories/fakes/FakeWhatsAppMessagesRepository';
import ManualWhatsAppProvider from '../providers/WhatsAppProvider/implementations/ManualWhatsAppProvider';
import SimulatorWhatsAppProvider from '../providers/WhatsAppProvider/implementations/SimulatorWhatsAppProvider';
import WhatsAppRegistry from '../providers/WhatsAppProvider/WhatsAppRegistry';
import WhatsAppClientNotifier from '../notifier/WhatsAppClientNotifier';
import WhatsAppSettingsService from './WhatsAppSettingsService';
import WhatsAppService, { toWhatsAppNumber } from './WhatsAppService';
import MembershipRemindersService from './MembershipRemindersService';

let messages: FakeWhatsAppMessagesRepository;
let simulator: SimulatorWhatsAppProvider;
let settings: WhatsAppSettingsService;
let whatsapp: WhatsAppService;
let notifier: WhatsAppClientNotifier;
let appointments: FakeAppointmentsRepository;
let plans: FakeMembershipPlansRepository;
let memberships: FakeMembershipsRepository;
let reminders: MembershipRemindersService;
let now: Date;

// "Agora": segunda-feira, 05/10/2026 às 9h
const at = (day: number, hours = 10): Date => new Date(2026, 9, day, hours);

const maria = Object.assign(new Client(), {
  id: 'maria',
  name: 'Maria Souza',
  email: null,
  phone: '11999990000',
});

async function book(date: Date, client: Client = maria): Promise<Appointment> {
  const appointment = await appointments.create(
    makeAppointmentData({ provider_id: 'joao', client_id: client.id, date }),
  );

  return Object.assign(appointment, {
    client,
    provider: { id: 'joao', name: 'João' },
    service: { id: 'service-id', name: 'Corte' },
    // Marcado dias antes (o pedido de confirmação só vai nesse caso)
    created_at: at(1),
  });
}

describe('WhatsApp', () => {
  beforeEach(() => {
    const settingsRepository = new FakeSettingsRepository();

    messages = new FakeWhatsAppMessagesRepository();
    simulator = new SimulatorWhatsAppProvider();
    settings = new WhatsAppSettingsService(
      settingsRepository,
      new WhatsAppRegistry(new ManualWhatsAppProvider(), simulator),
    );
    whatsapp = new WhatsAppService(messages, settings);

    const branding = new BrandingService(
      settingsRepository,
      new FakeStorageProvider(),
    );

    notifier = new WhatsAppClientNotifier(whatsapp, branding);
    appointments = new FakeAppointmentsRepository();
    plans = new FakeMembershipPlansRepository();
    memberships = new FakeMembershipsRepository(plans);
    reminders = new MembershipRemindersService(memberships, whatsapp, branding);

    now = at(5, 9);
    jest.spyOn(Date, 'now').mockImplementation(() => now.getTime());
  });

  it('should normalize Brazilian phone numbers', () => {
    expect(toWhatsAppNumber('(11) 99999-0000')).toBe('5511999990000');
    expect(toWhatsAppNumber('1133334444')).toBe('551133334444');
    expect(toWhatsAppNumber('5511999990000')).toBe('5511999990000');
    // Sem DDD
    expect(toWhatsAppNumber('999990000')).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
  });

  it('should not queue anything while turned off', async () => {
    await notifier.appointmentCreated(await book(at(8)));

    expect(messages.messages).toHaveLength(0);
    expect(await notifier.reaches(maria)).toBe(false);
  });

  it('should queue messages for the assisted mode, once each', async () => {
    await settings.update({
      provider: 'manual',
      groups: ['reminder', 'appointments', 'waitlist', 'membership'],
    });

    const appointment = await book(at(8));

    await notifier.appointmentCreated(appointment);
    await notifier.appointmentCreated(appointment);

    const [message] = await whatsapp.pending();

    expect(await whatsapp.countPending()).toBe(1);
    expect(message).toMatchObject({
      kind: 'appointment_created',
      phone: '5511999990000',
      status: 'pending',
    });
    expect(message.body).toContain('Olá, Maria!');
    expect(message.body).toContain('Corte');
    expect(message.wa_link).toMatch(
      /^https:\/\/wa\.me\/5511999990000\?text=Ol%C3%A1/,
    );

    // A barbearia enviou pelo WhatsApp
    await whatsapp.markSent(message.id, 'joao');

    expect(await whatsapp.countPending()).toBe(0);
    expect((await whatsapp.history())[0]).toMatchObject({
      status: 'sent',
    });
  });

  it('should respect the message groups and invalid phones', async () => {
    await settings.update({ provider: 'manual', groups: ['reminder'] });

    // Grupo "marcado/remarcado" desligado
    await notifier.appointmentCreated(await book(at(8)));
    expect(messages.messages).toHaveLength(0);

    await settings.update({ provider: 'manual', groups: ['appointments'] });

    const noAreaCode = Object.assign(new Client(), {
      id: 'ana',
      name: 'Ana',
      email: null,
      phone: '999990000',
    });

    await notifier.appointmentCreated(await book(at(9), noAreaCode));

    // Fica no histórico como não enviada, para a barbearia corrigir
    expect((await whatsapp.history())[0]).toMatchObject({
      status: 'skipped',
      error: 'Telefone sem DDD ou inválido.',
    });
  });

  it('should send right away with an automatic provider and retry failures', async () => {
    await settings.update({
      provider: 'simulator',
      groups: ['appointments'],
    });

    await notifier.appointmentCreated(await book(at(8)));

    expect(messages.messages[0]).toMatchObject({ status: 'sent', attempts: 1 });
    expect(simulator.outbox[0].to).toBe('5511999990000');

    // O provedor falha: tenta de novo na manutenção
    jest.spyOn(simulator, 'send').mockRejectedValueOnce(new Error('fora'));
    await notifier.appointmentCanceled(await book(at(9)));

    const failed = messages.messages[1];

    expect(failed.status).toBe('failed');

    await whatsapp.maintain();

    expect(failed).toMatchObject({ status: 'sent', attempts: 2 });
  });

  it('should expire messages that lost their purpose', async () => {
    await settings.update({ provider: 'manual', groups: ['appointments'] });
    await notifier.appointmentCreated(await book(at(5, 11)));

    now = at(5, 12);

    expect(await whatsapp.pending()).toHaveLength(0);
    await whatsapp.maintain();
    expect(messages.messages[0].status).toBe('expired');
  });

  it('should send the reminder even to clients without email', async () => {
    await settings.update({ provider: 'manual', groups: ['reminder'] });

    // Amanhã às 8h: dentro das 24h do pedido de confirmação
    const appointment = await book(at(6, 8));
    const send = new SendConfirmationRequestsService(appointments, notifier);

    expect(await send.execute()).toBe(1);

    const [reminder] = await whatsapp.pending();

    expect(reminder.kind).toBe('reminder');
    expect(reminder.body).toContain('Confirme ou cancele por aqui:');
    expect(reminder.body).toContain(
      `confirmar-agendamento?token=${appointment.confirmation_token}`,
    );
  });

  it('should warn about club fees coming due and overdue', async () => {
    await settings.update({ provider: 'manual', groups: ['membership'] });

    const plan = await plans.create({
      name: 'Corte ilimitado',
      description: null,
      price_cents: 9900,
      items: [],
      min_interval_days: null,
      weekdays: null,
      discount_percent: 0,
      active: true,
    });
    const soon = await memberships.create({
      client_id: 'maria',
      plan_id: plan.id,
      status: 'active',
      paid_until: '2026-10-07',
    });
    const late = await memberships.create({
      client_id: 'jose',
      plan_id: plan.id,
      status: 'active',
      paid_until: '2026-09-25',
    });

    // Os clientes das assinaturas (o fake só guarda id e nome)
    Object.assign(soon.client, { phone: '11999990000' });
    Object.assign(late.client, { phone: '11988887777' });
    jest.spyOn(memberships, 'findByStatus').mockResolvedValue([soon, late]);

    expect(await reminders.execute()).toBe(2);
    // Não repete no mesmo vencimento
    expect(await reminders.execute()).toBe(0);

    const kinds = (await whatsapp.pending()).map(item => item.kind);

    expect(kinds.sort()).toEqual(['membership_due', 'membership_overdue']);
    expect(
      (await whatsapp.pending()).find(item => item.kind === 'membership_due')
        ?.body,
    ).toContain('vence em 07/10');
  });
});
