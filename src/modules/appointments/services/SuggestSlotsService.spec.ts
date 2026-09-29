import AppError from '@shared/errors/AppError';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeServicesRepository from '@modules/catalog/repositories/fakes/FakeServicesRepository';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import Service from '@modules/catalog/infra/typeorm/entities/Service';
import User from '@modules/users/infra/typeorm/entities/User';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeTimeBlocksRepository from '../repositories/fakes/FakeTimeBlocksRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import CheckSlotService from './CheckSlotService';
import SuggestSlotsService from './SuggestSlotsService';

let fakeUsersRepository: FakeUsersRepository;
let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeProviderSchedulesRepository: FakeProviderSchedulesRepository;
let suggestSlots: SuggestSlotsService;
let haircut: Service;
let ana: User;

// 10/08/2020 é segunda-feira
const monday = (hours: number, minutes = 0): Date =>
  new Date(2020, 7, 10, hours, minutes);
const hhmm = (dates: Date[]): string[] =>
  dates.map(
    date =>
      `${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes(),
      ).padStart(2, '0')}`,
  );

describe('SuggestSlots', () => {
  beforeEach(async () => {
    fakeUsersRepository = new FakeUsersRepository();
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeProviderSchedulesRepository = new FakeProviderSchedulesRepository();
    const fakeServicesRepository = new FakeServicesRepository();
    const agendaSettings = new AgendaSettingsService(
      new FakeSettingsRepository(),
    );

    suggestSlots = new SuggestSlotsService(
      fakeUsersRepository,
      fakeAppointmentsRepository,
      fakeProviderSchedulesRepository,
      fakeServicesRepository,
      agendaSettings,
      new CheckSlotService(
        fakeAppointmentsRepository,
        fakeProviderSchedulesRepository,
        fakeServicesRepository,
        agendaSettings,
        fakeUsersRepository,
        new FakeTimeBlocksRepository(),
      ),
      new FakeTimeBlocksRepository(),
    );

    haircut = await fakeServicesRepository.create({
      name: 'Cabelo',
      duration_minutes: 45,
      price_cents: 4500,
    });

    ana = await fakeUsersRepository.create({
      name: 'Ana',
      email: 'ana@example.test',
      password: '123456',
    });
    await fakeProviderSchedulesRepository.replaceByProviderId(ana.id, [
      { day_of_week: 1, start_time: '09:00', end_time: '12:00' },
    ]);

    // "Agora" é domingo, véspera
    jest.spyOn(Date, 'now').mockImplementation(() => {
      return new Date(2020, 7, 9, 12).getTime();
    });
  });

  it('should suggest the nearest real free starts before and after', async () => {
    // Ana ocupada das 10:00 às 10:40
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: ana.id,
        client_id: 'client-id',
        date: monday(10),
        minutes: 40,
      }),
    );

    const { before, after } = await suggestSlots.execute({
      provider_id: ana.id,
      service_id: haircut.id,
      date: monday(10),
    });

    // A lista encadeada só teria 09:00 e 10:40; 09:15 cabe antes do
    // atendimento e 10:45 logo depois
    expect(hhmm(before)).toEqual(['09:00', '09:15']);
    expect(hhmm(after)).toEqual(['10:40', '10:45']);
  });

  it('should list other active providers free at the same time', async () => {
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: ana.id,
        client_id: 'client-id',
        date: monday(10),
      }),
    );

    const bruno = await fakeUsersRepository.create({
      name: 'Bruno',
      email: 'bruno@example.test',
      password: '123456',
    });
    const carla = await fakeUsersRepository.create({
      name: 'Carla',
      email: 'carla@example.test',
      password: '123456',
    });
    carla.active = false;
    const dani = await fakeUsersRepository.create({
      name: 'Dani',
      email: 'dani@example.test',
      password: '123456',
    });

    await fakeProviderSchedulesRepository.replaceByProviderId(bruno.id, [
      { day_of_week: 1, start_time: '09:00', end_time: '12:00' },
    ]);
    await fakeProviderSchedulesRepository.replaceByProviderId(carla.id, [
      { day_of_week: 1, start_time: '09:00', end_time: '12:00' },
    ]);
    // Dani só à tarde
    await fakeProviderSchedulesRepository.replaceByProviderId(dani.id, [
      { day_of_week: 1, start_time: '13:00', end_time: '18:00' },
    ]);

    const { others } = await suggestSlots.execute({
      provider_id: ana.id,
      service_id: haircut.id,
      date: monday(10),
    });

    expect(others.map(provider => provider.name)).toEqual(['Bruno']);
  });

  it('should not suggest anything on a day off', async () => {
    const { before, after } = await suggestSlots.execute({
      provider_id: ana.id,
      service_id: haircut.id,
      // Terça: Ana não trabalha
      date: new Date(2020, 7, 11, 10),
    });

    expect(before).toEqual([]);
    expect(after).toEqual([]);
  });

  it('should not suggest for a service that does not exist', async () => {
    await expect(
      suggestSlots.execute({
        provider_id: ana.id,
        service_id: 'unknown',
        date: monday(10),
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
