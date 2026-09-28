import FakeUsersRepository from '../repositories/fakes/FakeUsersRepository';
import FakeProviderSchedulesRepository from '../repositories/fakes/FakeProviderSchedulesRepository';
import ListTeamService from './ListTeamService';

let fakeUsersRepository: FakeUsersRepository;
let fakeProviderSchedulesRepository: FakeProviderSchedulesRepository;
let listTeam: ListTeamService;

describe('ListTeam', () => {
  beforeEach(() => {
    fakeUsersRepository = new FakeUsersRepository();
    fakeProviderSchedulesRepository = new FakeProviderSchedulesRepository();

    listTeam = new ListTeamService(
      fakeUsersRepository,
      fakeProviderSchedulesRepository,
    );
  });

  it('should list active providers first, inactive ones too, with schedules', async () => {
    const joao = await fakeUsersRepository.create({
      name: 'João',
      email: 'joao@example.test',
      password: '123456',
    });
    const ana = await fakeUsersRepository.create({
      name: 'Ana',
      email: 'ana@example.test',
      password: '123456',
    });
    ana.active = false;
    await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.test',
      password: '123456',
    });

    await fakeProviderSchedulesRepository.replaceByProviderId(joao.id, [
      { day_of_week: 5, start_time: '10:00', end_time: '19:00' },
      { day_of_week: 1, start_time: '09:00', end_time: '18:00' },
    ]);

    const team = await listTeam.execute();

    expect(team.map(member => [member.name, member.active])).toEqual([
      ['Carlos', true],
      ['João', true],
      ['Ana', false],
    ]);
    // Em ordem de dia da semana
    expect(team[1].schedules).toEqual([
      { day_of_week: 1, start_time: '09:00', end_time: '18:00' },
      { day_of_week: 5, start_time: '10:00', end_time: '19:00' },
    ]);
    expect(team[0]).not.toHaveProperty('password');
  });
});
