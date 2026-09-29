import AppError from '@shared/errors/AppError';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeServicesRepository from '@modules/catalog/repositories/fakes/FakeServicesRepository';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import Service from '@modules/catalog/infra/typeorm/entities/Service';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeTimeBlocksRepository from '../repositories/fakes/FakeTimeBlocksRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import CheckSlotService from './CheckSlotService';

let fakeAppointmentsRepository: FakeAppointmentsRepository;
let checkSlot: CheckSlotService;
let haircut: Service;

describe('CheckSlot', () => {
  beforeEach(async () => {
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    const fakeProviderSchedulesRepository =
      new FakeProviderSchedulesRepository();
    const fakeServicesRepository = new FakeServicesRepository();
    const fakeUsersRepository = new FakeUsersRepository();

    checkSlot = new CheckSlotService(
      fakeAppointmentsRepository,
      fakeProviderSchedulesRepository,
      fakeServicesRepository,
      new AgendaSettingsService(new FakeSettingsRepository()),
      fakeUsersRepository,
      new FakeTimeBlocksRepository(),
    );

    // Barbeiro dos testes, com o id fixo usado nos agendamentos
    const provider = await fakeUsersRepository.create({
      name: 'Barbeiro',
      email: 'barbeiro@example.test',
      password: '123456',
    });
    provider.id = 'provider-id';

    haircut = await fakeServicesRepository.create({
      name: 'Cabelo',
      duration_minutes: 45,
      price_cents: 4500,
    });

    await fakeProviderSchedulesRepository.replaceByProviderId('provider-id', [
      { day_of_week: 1, start_time: '08:00', end_time: '18:00' },
    ]);

    // "Agora" é segunda-feira, 10/08/2020 às 12h
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 7, 10, 12).getTime();
    });
  });

  it('should accept a free start that is not on the chained list', async () => {
    // Com 45 min a lista encadeada seria 08:00, 08:45... mas 14:10 está livre
    const result = await checkSlot.execute({
      provider_id: 'provider-id',
      service_id: haircut.id,
      date: new Date(2020, 7, 10, 14, 10),
    });

    expect(result).toEqual({
      available: true,
      end: new Date(2020, 7, 10, 14, 55),
    });
  });

  it('should explain why a start is not available', async () => {
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: 'provider-id',
        date: new Date(2020, 7, 10, 15),
        client_id: 'client-id',
      }),
    );

    const result = await checkSlot.execute({
      provider_id: 'provider-id',
      service_id: haircut.id,
      date: new Date(2020, 7, 10, 14, 30),
    });

    expect(result.available).toBe(false);
    expect(result).toHaveProperty('reason');
  });

  it('should reject an unknown service', async () => {
    await expect(
      checkSlot.execute({
        provider_id: 'provider-id',
        service_id: 'unknown',
        date: new Date(2020, 7, 10, 14),
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
