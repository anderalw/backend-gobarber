import AppError from '@shared/errors/AppError';
import FakeUsersRepository from '../repositories/fakes/FakeUsersRepository';
import ShowProfileService from './ShowProfileService';

let fakeUsersRepository: FakeUsersRepository;
let ShowProfile: ShowProfileService;

describe('UpdateProfile', () => {
  beforeEach(() => {
    fakeUsersRepository = new FakeUsersRepository();

    ShowProfile = new ShowProfileService(fakeUsersRepository);
  });

  it('Should be able to show profile user', async () => {
    const user = await fakeUsersRepository.create({
      name: 'Jhon Doe',
      email: 'jhondoe@email.com',
      password: '123456',
    });

    const profile = await ShowProfile.execute({
      user_id: user.id,
    });
    expect(profile.name).toBe('Jhon Doe');
    expect(profile.email).toBe('jhondoe@email.com');
  });

  it('Should be able to show profile from non-existing user', async () => {
    expect(
      ShowProfile.execute({
        user_id: 'non-existing-user-id',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
