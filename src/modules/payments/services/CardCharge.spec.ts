import AppError from '@shared/errors/AppError';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import FakeAppointmentsRepository from '@modules/appointments/repositories/fakes/FakeAppointmentsRepository';
import makeAppointmentData from '@modules/appointments/repositories/fakes/makeAppointmentData';
import Appointment from '@modules/appointments/infra/typeorm/entities/Appointment';
import FakeCardChargesRepository from '../repositories/fakes/FakeCardChargesRepository';
import FakeTerminalDevicesRepository from '../repositories/fakes/FakeTerminalDevicesRepository';
import SimulatorTerminalProvider from '../providers/TerminalProvider/implementations/SimulatorTerminalProvider';
import TerminalRegistry from '../providers/TerminalProvider/TerminalRegistry';
import TerminalSettingsService from './TerminalSettingsService';
import TerminalDevicesService from './TerminalDevicesService';
import CardChargeService from './CardChargeService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeSettingsRepository: FakeSettingsRepository;
let devices: TerminalDevicesService;
let deviceId: string;
let simulator: SimulatorTerminalProvider;
let settings: TerminalSettingsService;
let charges: CardChargeService;
let appointment: Appointment;

// Número de série da maquininha na operadora
const DEVICE = 'sim-balcao';
// "Agora" é 29/09/2026 às 12h; o atendimento começou às 11h
const at = (hours: number): Date => new Date(2026, 8, 29, hours);

// O admin conecta a conta do simulador e cadastra a maquininha do balcão
async function connect(): Promise<void> {
  await settings.update('simulator', { access_token: 'sim_barbearia_123' });
  deviceId = (await devices.create({ external_id: DEVICE, name: 'Balcão' })).id;
}

describe('Cobrança na maquininha', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    simulator = new SimulatorTerminalProvider();
    const registry = new TerminalRegistry(simulator);

    const fakeDevicesRepository = new FakeTerminalDevicesRepository();

    fakeSettingsRepository = new FakeSettingsRepository();
    settings = new TerminalSettingsService(
      fakeSettingsRepository,
      fakeDevicesRepository,
      registry,
    );
    devices = new TerminalDevicesService(fakeDevicesRepository, settings);
    charges = new CardChargeService(
      new FakeCardChargesRepository(),
      fakeAppointmentsRepository,
      fakeDevicesRepository,
      registry,
      settings,
    );

    // Preço de 45,00 (makeAppointmentData)
    appointment = await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: 'joao',
        client_id: 'maria',
        date: at(11),
      }),
    );

    jest.spyOn(Date, 'now').mockImplementation(() => at(12).getTime());
  });

  it('should be off until the admin chooses the operator', async () => {
    expect(await settings.get()).toMatchObject({
      provider: null,
      devices: [],
      available: [{ key: 'simulator', label: 'Simulador (testes)' }],
    });

    await expect(
      charges.start({
        appointment_id: appointment.id,
        device_id: deviceId,
        requester_id: 'joao',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should mark the appointment as paid when the terminal approves', async () => {
    await connect();

    const charge = await charges.start({
      appointment_id: appointment.id,
      device_id: deviceId,
      requester_id: 'joao',
    });

    expect(charge).toMatchObject({ status: 'pending', amount_cents: 4500 });

    // Ainda na maquininha: nada muda
    expect((await charges.refresh(charge.id)).status).toBe('pending');
    expect(appointment.attendance).toBeNull();

    // O cliente passa o cartão de débito
    const [waiting] = simulator.pendingFor(DEVICE);
    simulator.resolve(waiting.external_id, 'debit');

    const paid = await charges.refresh(charge.id);

    expect(paid).toMatchObject({ status: 'approved', method: 'debit' });
    expect(appointment).toMatchObject({
      attendance: 'completed',
      attendance_by: 'joao',
      payment_method: 'debit',
      // Igual ao preço: o valor não precisa ser guardado
      paid_cents: null,
    });

    // Atendimento já pago: não cobra de novo
    await expect(
      charges.start({
        appointment_id: appointment.id,
        device_id: deviceId,
        requester_id: 'joao',
      }),
    ).rejects.toMatchObject({ message: 'Este atendimento já está pago.' });
  });

  it('should keep a different amount and handle refusals', async () => {
    await connect();

    const first = await charges.start({
      appointment_id: appointment.id,
      device_id: deviceId,
      amount_cents: 5000,
      requester_id: 'joao',
    });
    simulator.resolve(simulator.pendingFor(DEVICE)[0].external_id, 'rejected');

    const refused = await charges.refresh(first.id);

    expect(refused.status).toBe('rejected');
    expect(appointment.attendance).toBeNull();

    // Tenta de novo, com gorjeta, no Pix
    const second = await charges.start({
      appointment_id: appointment.id,
      device_id: deviceId,
      amount_cents: 5000,
      requester_id: 'joao',
    });
    simulator.resolve(simulator.pendingFor(DEVICE)[0].external_id, 'pix');
    await charges.refresh(second.id);

    expect(appointment).toMatchObject({
      payment_method: 'pix',
      paid_cents: 5000,
    });
  });

  it('should cancel a charge and replace the previous one', async () => {
    await connect();

    const first = await charges.start({
      appointment_id: appointment.id,
      device_id: deviceId,
      requester_id: 'joao',
    });
    const second = await charges.start({
      appointment_id: appointment.id,
      device_id: deviceId,
      requester_id: 'joao',
    });

    // Mandar de novo tira a anterior da maquininha
    expect((await charges.refresh(first.id)).status).toBe('canceled');
    expect(simulator.pendingFor(DEVICE)).toHaveLength(1);

    const canceled = await charges.cancel(second.id);

    expect(canceled.status).toBe('canceled');
    expect(simulator.pendingFor(DEVICE)).toHaveLength(0);
  });

  it('should register a payment made with the screen closed', async () => {
    await connect();

    await charges.start({
      appointment_id: appointment.id,
      device_id: deviceId,
      requester_id: 'joao',
    });
    simulator.resolve(simulator.pendingFor(DEVICE)[0].external_id, 'credit');

    expect(await charges.refreshPending()).toBe(1);
    expect(appointment.payment_method).toBe('credit');
  });

  it('should not charge before the appointment starts', async () => {
    await connect();

    const later = await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: 'joao',
        client_id: 'maria',
        date: at(15),
      }),
    );

    await expect(
      charges.start({
        appointment_id: later.id,
        device_id: deviceId,
        requester_id: 'joao',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should only connect with valid credentials, kept encrypted', async () => {
    await expect(settings.update('simulator', {})).rejects.toMatchObject({
      message: 'Informe: Chave de acesso.',
    });
    await expect(
      settings.update('simulator', { access_token: 'errada' }),
    ).rejects.toBeInstanceOf(AppError);

    // Nada salvo: continua desligada
    expect((await settings.get()).provider).toBeNull();

    await settings.update('simulator', { access_token: 'sim_barbearia_123' });

    const admin = await settings.get(true);

    expect(admin).toMatchObject({
      provider: 'simulator',
      connected: true,
      // O segredo não volta inteiro para a tela
      credentials: { access_token: '••••_123' },
    });
    // Nem fica legível no banco
    expect(
      await fakeSettingsRepository.get('terminal_credentials:simulator'),
    ).not.toContain('sim_barbearia');
    // Barbeiro comum não vê as credenciais
    expect(await settings.get()).not.toHaveProperty('credentials');

    // Em branco mantém a chave salva; desligar e religar não pede de novo
    await settings.update(null);
    expect((await settings.get()).connected).toBe(false);
    await settings.update('simulator', { access_token: '' });
    expect((await settings.get()).connected).toBe(true);
  });

  it('should register the barbershop terminals', async () => {
    await expect(
      devices.create({ external_id: DEVICE, name: 'Balcão' }),
    ).rejects.toMatchObject({
      message: 'Conecte a conta da operadora primeiro.',
    });

    await connect();

    await expect(
      devices.create({ external_id: DEVICE, name: 'Outra' }),
    ).rejects.toMatchObject({ message: 'Esta maquininha já está cadastrada.' });

    // Os aparelhos da conta que ainda faltam cadastrar
    expect((await devices.discover()).map(item => item.id)).toEqual([
      'sim-cadeira-2',
    ]);

    expect((await settings.get()).devices).toEqual([
      { id: deviceId, name: 'Balcão' },
    ]);

    // Desativada: some da hora de cobrar e não recebe cobrança
    await devices.update(deviceId, { active: false });

    expect((await settings.get()).devices).toEqual([]);
    await expect(
      charges.start({
        appointment_id: appointment.id,
        device_id: deviceId,
        requester_id: 'joao',
      }),
    ).rejects.toMatchObject({ message: 'Maquininha não encontrada.' });

    await devices.delete(deviceId);

    expect((await settings.get(true)).registered).toEqual([]);
  });
});
