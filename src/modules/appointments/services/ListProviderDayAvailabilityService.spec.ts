import { addMinutes } from 'date-fns';

import AppError from '@shared/errors/AppError';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeServicesRepository from '@modules/catalog/repositories/fakes/FakeServicesRepository';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import Service from '@modules/catalog/infra/typeorm/entities/Service';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import ListProviderDayAvailabilityService from './ListProviderDayAvailabilityService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeServicesRepository: FakeServicesRepository;
let agendaSettings: AgendaSettingsService;
let listProviderDayAvailability: ListProviderDayAvailabilityService;
let haircut: Service;

// Agendamento já existente de 'minutes' minutos, sem intervalo
async function book(date: Date, minutes: number): Promise<void> {
  await fakeAppointmentsRepository.create({
    provider_id: 'user',
    client_id: 'client',
    service_id: 'service',
    price_cents: 0,
    date,
    end_date: addMinutes(date, minutes),
    blocked_until: addMinutes(date, minutes),
  });
}

describe('ListProviderDayAvailability', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeServicesRepository = new FakeServicesRepository();
    const fakeProviderSchedulesRepository = new FakeProviderSchedulesRepository();
    agendaSettings = new AgendaSettingsService(new FakeSettingsRepository());

    listProviderDayAvailability = new ListProviderDayAvailabilityService(
      fakeAppointmentsRepository,
      fakeProviderSchedulesRepository,
      fakeServicesRepository,
      agendaSettings,
    );

    haircut = await fakeServicesRepository.create({
      name: 'Cabelo',
      duration_minutes: 45,
      price_cents: 4500,
    });

    // 20/05/2020 é quarta-feira: das 09:00 às 13:00
    await fakeProviderSchedulesRepository.replaceByProviderId('user', [
      { day_of_week: 3, start_time: '09:00', end_time: '13:00' },
    ]);

    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 4, 20, 8).getTime();
    });
  });

  const request = () =>
    listProviderDayAvailability.execute({
      provider_id: 'user',
      service_id: haircut.id,
      year: 2020,
      month: 5,
      day: 20,
    });

  it('should list the start times that fit the service duration', async () => {
    await agendaSettings.update({ buffer_minutes: 15 });

    // 45 min + 15 de intervalo: um horário por hora
    expect(await request()).toEqual([
      { time: '09:00' },
      { time: '10:00' },
      { time: '11:00' },
      { time: '12:00' },
    ]);
  });

  it('should skip the time taken by existing appointments', async () => {
    // Ocupado das 10:00 às 11:00
    await book(new Date(2020, 4, 20, 10), 60);

    expect(await request()).toEqual([
      { time: '09:00' },
      { time: '11:00' },
      { time: '11:45' },
    ]);
  });

  it('should not list times that already passed', async () => {
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 4, 20, 10, 50).getTime();
    });

    expect(await request()).toEqual([{ time: '11:15' }, { time: '12:00' }]);
  });

  it('should return no times on a day the provider does not work', async () => {
    // 21/05/2020 é quinta-feira, sem horário configurado
    const availability = await listProviderDayAvailability.execute({
      provider_id: 'user',
      service_id: haircut.id,
      year: 2020,
      month: 5,
      day: 21,
    });

    expect(availability).toEqual([]);
  });

  it('should list times to reschedule an appointment, ignoring its own time', async () => {
    // Agendamento de 60 min às 10:00
    const appointment = await fakeAppointmentsRepository.create({
      provider_id: 'user',
      client_id: 'client',
      service_id: 'service',
      price_cents: 0,
      date: new Date(2020, 4, 20, 10),
      end_date: new Date(2020, 4, 20, 11),
      blocked_until: new Date(2020, 4, 20, 11),
    });

    const availability = await listProviderDayAvailability.execute({
      provider_id: 'user',
      appointment_id: appointment.id,
      requester: { id: 'client', role: 'client' },
      year: 2020,
      month: 5,
      day: 20,
    });

    // Usa a duração do agendamento (60 min) e o 10:00 dele continua livre
    expect(availability).toEqual([
      { time: '09:00' },
      { time: '10:00' },
      { time: '11:00' },
      { time: '12:00' },
    ]);

    // Outro cliente não pode consultar para remarcar este agendamento
    await expect(
      listProviderDayAvailability.execute({
        provider_id: 'user',
        appointment_id: appointment.id,
        requester: { id: 'other-client', role: 'client' },
        year: 2020,
        month: 5,
        day: 20,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should not list times for an inactive service', async () => {
    haircut.active = false;
    await fakeServicesRepository.save(haircut);

    await expect(request()).rejects.toBeInstanceOf(AppError);
  });
});
