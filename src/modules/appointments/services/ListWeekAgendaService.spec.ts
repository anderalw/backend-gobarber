import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeTimeBlocksRepository from '../repositories/fakes/FakeTimeBlocksRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import ListDayAgendaService from './ListDayAgendaService';
import ListWeekAgendaService from './ListWeekAgendaService';

describe('ListWeekAgenda', () => {
  it('should list seven days from the given date, crossing months', async () => {
    const fakeUsersRepository = new FakeUsersRepository();
    const fakeAppointmentsRepository = new FakeAppointmentsRepository();
    const fakeProviderSchedulesRepository =
      new FakeProviderSchedulesRepository();

    const listWeekAgenda = new ListWeekAgendaService(
      new ListDayAgendaService(
        fakeUsersRepository,
        fakeAppointmentsRepository,
        fakeProviderSchedulesRepository,
        new FakeTimeBlocksRepository(),
      ),
    );

    const carlos = await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.test',
      password: '123456',
    });

    // Só às segundas (1)
    await fakeProviderSchedulesRepository.replaceByProviderId(carlos.id, [
      { day_of_week: 1, start_time: '09:00', end_time: '18:00' },
    ]);

    // Quinta, 01/10/2026
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: carlos.id,
        client_id: 'client-id',
        date: new Date(2026, 9, 1, 10),
      }),
    );

    // Domingo, 27/09/2026
    const week = await listWeekAgenda.execute({
      day: 27,
      month: 9,
      year: 2026,
    });

    expect(week.map(day => day.date)).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    // Segunda com expediente, domingo de folga
    expect(week[1].providers[0].schedule).toEqual({
      start_time: '09:00',
      end_time: '18:00',
    });
    expect(week[0].providers[0].schedule).toBeNull();
    // O atendimento aparece só na quinta
    expect(week.map(day => day.appointments.length)).toEqual([
      0, 0, 0, 0, 1, 0, 0,
    ]);
  });
});
