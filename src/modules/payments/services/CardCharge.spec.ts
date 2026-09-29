import AppError from '@shared/errors/AppError';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import FakeAppointmentsRepository from '@modules/appointments/repositories/fakes/FakeAppointmentsRepository';
import makeAppointmentData from '@modules/appointments/repositories/fakes/makeAppointmentData';
import Appointment from '@modules/appointments/infra/typeorm/entities/Appointment';
import FakeCardChargesRepository from '../repositories/fakes/FakeCardChargesRepository';
import SimulatorTerminalProvider from '../providers/TerminalProvider/implementations/SimulatorTerminalProvider';
import TerminalRegistry from '../providers/TerminalProvider/TerminalRegistry';
import TerminalSettingsService from './TerminalSettingsService';
import CardChargeService from './CardChargeService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let simulator: SimulatorTerminalProvider;
let settings: TerminalSettingsService;
let charges: CardChargeService;
let appointment: Appointment;

const DEVICE = 'sim-balcao';
// "Agora" é 29/09/2026 às 12h; o atendimento começou às 11h
const at = (hours: number): Date => new Date(2026, 8, 29, hours);

describe('Cobrança na maquininha', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    simulator = new SimulatorTerminalProvider();
    const registry = new TerminalRegistry(simulator);

    settings = new TerminalSettingsService(
      new FakeSettingsRepository(),
      registry,
    );
    charges = new CardChargeService(
      new FakeCardChargesRepository(),
      fakeAppointmentsRepository,
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
        device_id: DEVICE,
        requester_id: 'joao',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should mark the appointment as paid when the terminal approves', async () => {
    await settings.update('simulator');

    const charge = await charges.start({
      appointment_id: appointment.id,
      device_id: DEVICE,
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
        device_id: DEVICE,
        requester_id: 'joao',
      }),
    ).rejects.toMatchObject({ message: 'Este atendimento já está pago.' });
  });

  it('should keep a different amount and handle refusals', async () => {
    await settings.update('simulator');

    const first = await charges.start({
      appointment_id: appointment.id,
      device_id: DEVICE,
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
      device_id: DEVICE,
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
    await settings.update('simulator');

    const first = await charges.start({
      appointment_id: appointment.id,
      device_id: DEVICE,
      requester_id: 'joao',
    });
    const second = await charges.start({
      appointment_id: appointment.id,
      device_id: DEVICE,
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
    await settings.update('simulator');

    await charges.start({
      appointment_id: appointment.id,
      device_id: DEVICE,
      requester_id: 'joao',
    });
    simulator.resolve(simulator.pendingFor(DEVICE)[0].external_id, 'credit');

    expect(await charges.refreshPending()).toBe(1);
    expect(appointment.payment_method).toBe('credit');
  });

  it('should not charge before the appointment starts', async () => {
    await settings.update('simulator');

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
        device_id: DEVICE,
        requester_id: 'joao',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
