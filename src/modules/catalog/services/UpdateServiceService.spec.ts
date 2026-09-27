import AppError from '@shared/errors/AppError';
import FakeServicesRepository from '../repositories/fakes/FakeServicesRepository';
import UpdateServiceService from './UpdateServiceService';
import ListServicesService from './ListServicesService';

let fakeServicesRepository: FakeServicesRepository;
let updateService: UpdateServiceService;
let listServices: ListServicesService;

describe('UpdateService', () => {
  beforeEach(() => {
    fakeServicesRepository = new FakeServicesRepository();
    updateService = new UpdateServiceService(fakeServicesRepository);
    listServices = new ListServicesService(fakeServicesRepository);
  });

  it('should update a service and hide it from clients when deactivated', async () => {
    const service = await fakeServicesRepository.create({
      name: 'Barba',
      duration_minutes: 30,
      price_cents: 3000,
    });

    const updated = await updateService.execute({
      id: service.id,
      name: 'Barba completa',
      duration_minutes: 40,
      price_cents: 3500,
      active: false,
    });

    expect(updated).toMatchObject({
      name: 'Barba completa',
      duration_minutes: 40,
      price_cents: 3500,
      active: false,
    });

    expect(await listServices.execute({ include_inactive: false })).toEqual(
      [],
    );
    expect(await listServices.execute({ include_inactive: true })).toHaveLength(
      1,
    );
  });

  it('should not rename a service to the name of another one', async () => {
    await fakeServicesRepository.create({
      name: 'Cabelo',
      duration_minutes: 45,
      price_cents: 4500,
    });
    const barba = await fakeServicesRepository.create({
      name: 'Barba',
      duration_minutes: 30,
      price_cents: 3000,
    });

    await expect(
      updateService.execute({
        id: barba.id,
        name: 'CABELO',
        duration_minutes: 30,
        price_cents: 3000,
        active: true,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should not update a non-existing service', async () => {
    await expect(
      updateService.execute({
        id: 'non-existing',
        name: 'Barba',
        duration_minutes: 30,
        price_cents: 3000,
        active: true,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
