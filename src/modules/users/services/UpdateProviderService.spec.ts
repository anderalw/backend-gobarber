import AppError from '@shared/errors/AppError';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import FakeUsersRepository from '../repositories/fakes/FakeUsersRepository';
import UpdateProviderService from './UpdateProviderService';

let fakeUsersRepository: FakeUsersRepository;
let fakeCacheProvider: FakeCacheProvider;
let updateProvider: UpdateProviderService;

describe('UpdateProvider', () => {
  beforeEach(() => {
    fakeUsersRepository = new FakeUsersRepository();
    fakeCacheProvider = new FakeCacheProvider();

    updateProvider = new UpdateProviderService(
      fakeUsersRepository,
      fakeCacheProvider,
    );
  });

  it('should update the name and e-mail of a provider', async () => {
    const carlos = await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.test',
      password: '123456',
    });
    const invalidate = jest.spyOn(fakeCacheProvider, 'invalidatePrefix');

    const updated = await updateProvider.execute({
      provider_id: carlos.id,
      name: '  Carlos Silva ',
      email: 'Carlos.Silva@Example.test',
    });

    expect(updated).toMatchObject({
      name: 'Carlos Silva',
      email: 'carlos.silva@example.test',
    });
    // A senha não muda
    expect(updated.password).toBe('123456');
    expect(invalidate).toHaveBeenCalledWith('providers-list');
  });

  it('should keep the same e-mail of the provider', async () => {
    const carlos = await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.test',
      password: '123456',
    });

    await expect(
      updateProvider.execute({
        provider_id: carlos.id,
        name: 'Carlos Silva',
        email: 'carlos@example.test',
      }),
    ).resolves.toMatchObject({ name: 'Carlos Silva' });
  });

  it('should not use the e-mail of another provider', async () => {
    await fakeUsersRepository.create({
      name: 'João',
      email: 'joao@example.test',
      password: '123456',
    });
    const carlos = await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.test',
      password: '123456',
    });

    await expect(
      updateProvider.execute({
        provider_id: carlos.id,
        name: 'Carlos',
        email: 'joao@example.test',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should not update a provider that does not exist', async () => {
    await expect(
      updateProvider.execute({
        provider_id: 'unknown',
        name: 'Carlos',
        email: 'carlos@example.test',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
