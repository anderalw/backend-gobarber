import AppError from '@shared/errors/AppError';
import FakeServicesRepository from '../repositories/fakes/FakeServicesRepository';
import CreateServiceService from './CreateServiceService';
import ReorderServicesService from './ReorderServicesService';

let fakeServicesRepository: FakeServicesRepository;
let createService: CreateServiceService;
let reorderServices: ReorderServicesService;

const create = (name: string) =>
  createService.execute({ name, duration_minutes: 30, price_cents: 4500 });

describe('Ordem dos serviços', () => {
  beforeEach(() => {
    fakeServicesRepository = new FakeServicesRepository();
    createService = new CreateServiceService(fakeServicesRepository);
    reorderServices = new ReorderServicesService(fakeServicesRepository);
  });

  it('should add new services at the end of the list', async () => {
    await create('Corte');
    await create('Barba');

    const services = await fakeServicesRepository.findAll({
      only_active: false,
    });

    expect(services.map(service => service.name)).toEqual(['Corte', 'Barba']);
  });

  it('should save the order chosen by the barbershop', async () => {
    const corte = await create('Corte');
    const barba = await create('Barba');
    const combo = await create('Combo');

    const services = await reorderServices.execute([
      combo.id,
      corte.id,
      barba.id,
    ]);

    expect(services.map(service => service.name)).toEqual([
      'Combo',
      'Corte',
      'Barba',
    ]);
  });

  it('should not reorder an incomplete or repeated list', async () => {
    const corte = await create('Corte');
    await create('Barba');

    await expect(reorderServices.execute([corte.id])).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(
      reorderServices.execute([corte.id, corte.id]),
    ).rejects.toBeInstanceOf(AppError);
  });
});
