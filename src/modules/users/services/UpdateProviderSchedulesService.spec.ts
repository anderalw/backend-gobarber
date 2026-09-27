import AppError from '@shared/errors/AppError';
import FakeUsersRepository from '../repositories/fakes/FakeUsersRepository';
import FakeProviderSchedulesRepository from '../repositories/fakes/FakeProviderSchedulesRepository';
import UpdateProviderSchedulesService from './UpdateProviderSchedulesService';

let fakeUsersRepository: FakeUsersRepository;
let fakeProviderSchedulesRepository: FakeProviderSchedulesRepository;
let updateProviderSchedules: UpdateProviderSchedulesService;

describe('UpdateProviderSchedules', () => {
  beforeEach(() => {
    fakeUsersRepository = new FakeUsersRepository();
    fakeProviderSchedulesRepository = new FakeProviderSchedulesRepository();
    updateProviderSchedules = new UpdateProviderSchedulesService(
      fakeProviderSchedulesRepository,
      fakeUsersRepository,
    );
  });

  it('should replace the old schedules with the new ones', async () => {
    const provider = await fakeUsersRepository.create({
      name: 'Jhon Doe',
      email: 'jhondoe@email.com',
      password: '123456',
    });

    await updateProviderSchedules.execute({
      provider_id: provider.id,
      schedules: [
        { day_of_week: 1, start_time: '08:00', end_time: '18:00' },
        { day_of_week: 2, start_time: '08:00', end_time: '18:00' },
      ],
    });

    await updateProviderSchedules.execute({
      provider_id: provider.id,
      schedules: [{ day_of_week: 5, start_time: '10:00', end_time: '14:00' }],
    });

    const schedules = await fakeProviderSchedulesRepository.findByProviderId(
      provider.id,
    );

    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({
      provider_id: provider.id,
      day_of_week: 5,
      start_time: '10:00',
      end_time: '14:00',
    });
  });

  it('should not change the schedules of other providers', async () => {
    const provider = await fakeUsersRepository.create({
      name: 'Jhon Doe',
      email: 'jhondoe@email.com',
      password: '123456',
    });

    await fakeProviderSchedulesRepository.replaceByProviderId('other', [
      { day_of_week: 3, start_time: '08:00', end_time: '12:00' },
    ]);

    await updateProviderSchedules.execute({
      provider_id: provider.id,
      schedules: [],
    });

    const otherSchedules = await fakeProviderSchedulesRepository.findByProviderId(
      'other',
    );

    expect(otherSchedules).toHaveLength(1);
  });

  it('should not update schedules of a non-existing provider', async () => {
    await expect(
      updateProviderSchedules.execute({
        provider_id: 'non-existing',
        schedules: [],
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
