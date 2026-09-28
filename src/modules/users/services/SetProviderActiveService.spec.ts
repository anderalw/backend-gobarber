import AppError from '@shared/errors/AppError';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import FakeAppointmentsRepository from '@modules/appointments/repositories/fakes/FakeAppointmentsRepository';
import makeAppointmentData from '@modules/appointments/repositories/fakes/makeAppointmentData';
import FakeUsersRepository from '../repositories/fakes/FakeUsersRepository';
import User from '../infra/typeorm/entities/User';
import SetProviderActiveService from './SetProviderActiveService';

const ONE_DAY = 24 * 60 * 60 * 1000;

let fakeUsersRepository: FakeUsersRepository;
let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeCacheProvider: FakeCacheProvider;
let setProviderActive: SetProviderActiveService;
let admin: User;
let carlos: User;

describe('SetProviderActive', () => {
  beforeEach(async () => {
    fakeUsersRepository = new FakeUsersRepository();
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeCacheProvider = new FakeCacheProvider();

    setProviderActive = new SetProviderActiveService(
      fakeUsersRepository,
      fakeAppointmentsRepository,
      fakeCacheProvider,
    );

    admin = await fakeUsersRepository.create({
      name: 'Admin',
      email: 'admin@example.test',
      password: '123456',
    });
    carlos = await fakeUsersRepository.create({
      name: 'Carlos',
      email: 'carlos@example.test',
      password: '123456',
    });
  });

  it('should deactivate and reactivate a provider', async () => {
    const invalidate = jest.spyOn(fakeCacheProvider, 'invalidatePrefix');

    await setProviderActive.execute({
      requester_id: admin.id,
      provider_id: carlos.id,
      active: false,
    });

    expect(carlos.active).toBe(false);
    expect(invalidate).toHaveBeenCalledWith('providers-list');

    await setProviderActive.execute({
      requester_id: admin.id,
      provider_id: carlos.id,
      active: true,
    });

    expect(carlos.active).toBe(true);
  });

  it('should not deactivate a provider with upcoming appointments', async () => {
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: carlos.id,
        client_id: 'client-id',
        date: new Date(Date.now() + ONE_DAY),
      }),
    );

    await expect(
      setProviderActive.execute({
        requester_id: admin.id,
        provider_id: carlos.id,
        active: false,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('1 agendamento futuro'),
    });

    expect(carlos.active).toBe(true);
  });

  it('should ignore past and canceled appointments when deactivating', async () => {
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: carlos.id,
        client_id: 'client-id',
        date: new Date(Date.now() - ONE_DAY),
      }),
    );
    const canceled = await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: carlos.id,
        client_id: 'client-id',
        date: new Date(Date.now() + ONE_DAY),
      }),
    );
    canceled.canceled_at = new Date();

    await setProviderActive.execute({
      requester_id: admin.id,
      provider_id: carlos.id,
      active: false,
    });

    expect(carlos.active).toBe(false);
  });

  it('should not let an admin deactivate their own account', async () => {
    await expect(
      setProviderActive.execute({
        requester_id: admin.id,
        provider_id: admin.id,
        active: false,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should not change a provider that does not exist', async () => {
    await expect(
      setProviderActive.execute({
        requester_id: admin.id,
        provider_id: 'unknown',
        active: false,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
