import AppError from '@shared/errors/AppError';
import FakeServicesRepository from '../repositories/fakes/FakeServicesRepository';
import CreateServiceService from './CreateServiceService';

let fakeServicesRepository: FakeServicesRepository;
let createService: CreateServiceService;

describe('CreateService', () => {
  beforeEach(() => {
    fakeServicesRepository = new FakeServicesRepository();
    createService = new CreateServiceService(fakeServicesRepository);
  });

  it('should create an active service', async () => {
    const service = await createService.execute({
      name: '  Cabelo e barba ',
      duration_minutes: 60,
      price_cents: 7000,
    });

    expect(service).toMatchObject({
      name: 'Cabelo e barba',
      duration_minutes: 60,
      price_cents: 7000,
      active: true,
    });
  });

  it('should not accept invalid durations, prices or names', async () => {
    const invalid = [
      { name: 'Barba', duration_minutes: 0, price_cents: 3000 },
      { name: 'Barba', duration_minutes: 42, price_cents: 3000 },
      { name: 'Barba', duration_minutes: 485, price_cents: 3000 },
      { name: 'Barba', duration_minutes: 30, price_cents: -1 },
      { name: 'Barba', duration_minutes: 30, price_cents: 30.5 },
      { name: '   ', duration_minutes: 30, price_cents: 3000 },
    ];

    await Promise.all(
      invalid.map(data =>
        expect(createService.execute(data)).rejects.toBeInstanceOf(AppError),
      ),
    );
  });

  it('should not create two services with the same name', async () => {
    await createService.execute({
      name: 'Cabelo',
      duration_minutes: 45,
      price_cents: 4500,
    });

    await expect(
      createService.execute({
        name: 'cabelo',
        duration_minutes: 30,
        price_cents: 3000,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
