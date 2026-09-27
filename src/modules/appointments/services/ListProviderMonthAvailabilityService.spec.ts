import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import ListProviderMonthAvailabilityService from './ListProviderMonthAvailabilityService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeProviderSchedulesRepository: FakeProviderSchedulesRepository;
let listProviderMonthAvailability: ListProviderMonthAvailabilityService;

describe('ListProviderMonthAvailability', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeProviderSchedulesRepository = new FakeProviderSchedulesRepository();
    listProviderMonthAvailability = new ListProviderMonthAvailabilityService(
      fakeAppointmentsRepository,
      fakeProviderSchedulesRepository,
    );

    // Segunda a sábado, das 08:00 às 18:00 (10 horários por dia)
    await fakeProviderSchedulesRepository.replaceByProviderId(
      'user',
      [1, 2, 3, 4, 5, 6].map(day_of_week => ({
        day_of_week,
        start_time: '08:00',
        end_time: '18:00',
      })),
    );

    jest.spyOn(Date, 'now').mockImplementationOnce(() => {
      return new Date(2020, 4, 1, 12).getTime();
    });
  });

  it('Should be able to list the month availability from provider', async () => {
    // Lota o dia 20/05/2020 (quarta-feira): 8h às 17h
    const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

    await Promise.all(
      hours.map(hour =>
        fakeAppointmentsRepository.create({
          provider_id: 'user',
          client_id: 'client',
          date: new Date(2020, 4, 20, hour, 0, 0),
        }),
      ),
    );

    await fakeAppointmentsRepository.create({
      provider_id: 'user',
      client_id: 'client',
      date: new Date(2020, 4, 21, 8, 0, 0),
    });

    const availability = await listProviderMonthAvailability.execute({
      provider_id: 'user',
      year: 2020,
      month: 5,
    });

    expect(availability).toEqual(
      expect.arrayContaining([
        { day: 19, available: true },
        { day: 20, available: false },
        { day: 21, available: true },
        { day: 22, available: true },
        // 24/05/2020 é domingo, sem horário configurado
        { day: 24, available: false },
      ]),
    );
  });
});
