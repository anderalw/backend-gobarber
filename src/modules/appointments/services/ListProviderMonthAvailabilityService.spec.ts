import { addMinutes } from 'date-fns';

import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeServicesRepository from '@modules/catalog/repositories/fakes/FakeServicesRepository';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeTimeBlocksRepository from '../repositories/fakes/FakeTimeBlocksRepository';
import ListProviderMonthAvailabilityService from './ListProviderMonthAvailabilityService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeServicesRepository: FakeServicesRepository;
let listProviderMonthAvailability: ListProviderMonthAvailabilityService;

describe('ListProviderMonthAvailability', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeServicesRepository = new FakeServicesRepository();
    const fakeProviderSchedulesRepository =
      new FakeProviderSchedulesRepository();

    listProviderMonthAvailability = new ListProviderMonthAvailabilityService(
      fakeAppointmentsRepository,
      fakeProviderSchedulesRepository,
      fakeServicesRepository,
      new AgendaSettingsService(new FakeSettingsRepository()),
      new FakeTimeBlocksRepository(),
    );

    // Segunda a sábado, das 08:00 às 12:00
    await fakeProviderSchedulesRepository.replaceByProviderId(
      'user',
      [1, 2, 3, 4, 5, 6].map(day_of_week => ({
        day_of_week,
        start_time: '08:00',
        end_time: '12:00',
      })),
    );

    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 4, 1, 12).getTime();
    });
  });

  it('should mark the days with room for the service', async () => {
    // Dia 20/05/2020 (quarta) lotado: 08:00 às 11:30
    const date = new Date(2020, 4, 20, 8);
    await fakeAppointmentsRepository.create({
      provider_id: 'user',
      client_id: 'client',
      service_id: 'service',
      price_cents: 0,
      date,
      end_date: addMinutes(date, 210),
      blocked_until: addMinutes(date, 210),
    });

    const longService = await fakeServicesRepository.create({
      name: 'Cabelo e barba',
      duration_minutes: 60,
      price_cents: 7000,
    });
    const shortService = await fakeServicesRepository.create({
      name: 'Pezinho',
      duration_minutes: 30,
      price_cents: 1500,
    });

    const forLongService = await listProviderMonthAvailability.execute({
      provider_id: 'user',
      service_id: longService.id,
      year: 2020,
      month: 5,
    });

    expect(forLongService).toEqual(
      expect.arrayContaining([
        { day: 19, available: true },
        // Sobram 30 min: não cabe 1 hora
        { day: 20, available: false },
        { day: 21, available: true },
        // 24/05/2020 é domingo, sem horário configurado
        { day: 24, available: false },
      ]),
    );

    const forShortService = await listProviderMonthAvailability.execute({
      provider_id: 'user',
      service_id: shortService.id,
      year: 2020,
      month: 5,
    });

    // Os 30 min que sobram (11:30 às 12:00) bastam
    expect(forShortService).toEqual(
      expect.arrayContaining([{ day: 20, available: true }]),
    );
  });
});
