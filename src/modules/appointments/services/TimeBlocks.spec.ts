import AppError from '@shared/errors/AppError';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeProviderSchedulesRepository from '@modules/users/repositories/fakes/FakeProviderSchedulesRepository';
import FakeNotificationsRepository from '@modules/notifications/repositories/fakes/FakeNotificationsRepository';
import FakeServicesRepository from '@modules/catalog/repositories/fakes/FakeServicesRepository';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import Service from '@modules/catalog/infra/typeorm/entities/Service';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import FakeAppointmentsRepository from '../repositories/fakes/FakeAppointmentsRepository';
import FakeClientNotifier from '../notifier/FakeClientNotifier';
import FakeTimeBlocksRepository from '../repositories/fakes/FakeTimeBlocksRepository';
import FakeBlockReasonsRepository from '../repositories/fakes/FakeBlockReasonsRepository';
import makeAppointmentData from '../repositories/fakes/makeAppointmentData';
import CreateTimeBlockService from './CreateTimeBlockService';
import DeleteTimeBlockService from './DeleteTimeBlockService';
import CreateRecurringTimeBlockService from './CreateRecurringTimeBlockService';
import CreateAppointmentsService from './CreateAppointmentsService';
import ListProviderDayAvailabilityService from './ListProviderDayAvailabilityService';
import ListProviderMonthAvailabilityService from './ListProviderMonthAvailabilityService';
import ListDayAgendaService from './ListDayAgendaService';
import NoShowPolicyService from './NoShowPolicyService';

let fakeUsersRepository: FakeUsersRepository;
let fakeAppointmentsRepository: FakeAppointmentsRepository;
let fakeTimeBlocksRepository: FakeTimeBlocksRepository;
let fakeBlockReasonsRepository: FakeBlockReasonsRepository;
let lunchReasonId: string;
let agendaSettings: AgendaSettingsService;
let createTimeBlock: CreateTimeBlockService;
let deleteTimeBlock: DeleteTimeBlockService;
let createAppointment: CreateAppointmentsService;
let listDayAvailability: ListProviderDayAvailabilityService;
let listMonthAvailability: ListProviderMonthAvailabilityService;
let listDayAgenda: ListDayAgendaService;
let providerId: string;
let haircut: Service;

// 20/05/2020 é quarta-feira
const at = (hours: number, minutes = 0, day = 20): Date =>
  new Date(2020, 4, day, hours, minutes);

describe('Bloqueios de horário', () => {
  beforeEach(async () => {
    fakeUsersRepository = new FakeUsersRepository();
    fakeAppointmentsRepository = new FakeAppointmentsRepository();
    fakeTimeBlocksRepository = new FakeTimeBlocksRepository();
    fakeBlockReasonsRepository = new FakeBlockReasonsRepository();
    lunchReasonId = (await fakeBlockReasonsRepository.create('Almoço')).id;
    const fakeProviderSchedulesRepository =
      new FakeProviderSchedulesRepository();
    const fakeServicesRepository = new FakeServicesRepository();
    agendaSettings = new AgendaSettingsService(new FakeSettingsRepository());

    createTimeBlock = new CreateTimeBlockService(
      fakeUsersRepository,
      fakeAppointmentsRepository,
      fakeTimeBlocksRepository,
      fakeBlockReasonsRepository,
    );
    deleteTimeBlock = new DeleteTimeBlockService(fakeTimeBlocksRepository);
    createAppointment = new CreateAppointmentsService(
      fakeAppointmentsRepository,
      new FakeNotificationsRepository(),
      new FakeCacheProvider(),
      fakeProviderSchedulesRepository,
      fakeServicesRepository,
      agendaSettings,
      fakeUsersRepository,
      fakeTimeBlocksRepository,
      new FakeClientNotifier(),
    );
    listDayAvailability = new ListProviderDayAvailabilityService(
      fakeAppointmentsRepository,
      fakeProviderSchedulesRepository,
      fakeServicesRepository,
      agendaSettings,
      fakeTimeBlocksRepository,
    );
    listMonthAvailability = new ListProviderMonthAvailabilityService(
      fakeAppointmentsRepository,
      fakeProviderSchedulesRepository,
      fakeServicesRepository,
      agendaSettings,
      fakeTimeBlocksRepository,
    );
    listDayAgenda = new ListDayAgendaService(
      fakeUsersRepository,
      fakeAppointmentsRepository,
      fakeProviderSchedulesRepository,
      fakeTimeBlocksRepository,
      new NoShowPolicyService(
        new FakeSettingsRepository(),
        fakeAppointmentsRepository,
      ),
    );

    const provider = await fakeUsersRepository.create({
      name: 'Barbeiro',
      email: 'barbeiro@example.test',
      password: '123456',
    });
    providerId = provider.id;

    haircut = await fakeServicesRepository.create({
      name: 'Cabelo',
      duration_minutes: 60,
      price_cents: 4500,
    });

    // Todos os dias úteis, das 09:00 às 13:00
    await fakeProviderSchedulesRepository.replaceByProviderId(
      providerId,
      [1, 2, 3, 4, 5].map(day_of_week => ({
        day_of_week,
        start_time: '09:00',
        end_time: '13:00',
      })),
    );

    // "Agora" é 20/05/2020 às 08:00
    jest.spyOn(Date, 'now').mockImplementation(() => at(8).getTime());
  });

  // Bloqueio de um barbeiro só (o dos testes)
  const block = async (start: Date, end: Date, reason_id = lunchReasonId) =>
    (
      await createTimeBlock.execute({
        provider_ids: [providerId],
        start_date: start,
        end_date: end,
        reason_id,
        requester_id: providerId,
      })
    )[0];

  const dayTimes = async (): Promise<string[]> =>
    (
      await listDayAvailability.execute({
        provider_id: providerId,
        service_id: haircut.id,
        day: 20,
        month: 5,
        year: 2020,
      })
    ).map(({ time }) => time);

  it('should save the name of the chosen reason', async () => {
    const created = await block(at(11), at(12));

    expect(created).toMatchObject({
      provider_id: providerId,
      start_date: at(11),
      end_date: at(12),
      reason: 'Almoço',
      created_by: providerId,
    });
  });

  it('should require a registered reason', async () => {
    await expect(block(at(11), at(12), '')).rejects.toMatchObject({
      message: 'Escolha o motivo do bloqueio.',
    });
    await expect(
      block(at(11), at(12), '00000000-0000-0000-0000-000000000000'),
    ).rejects.toMatchObject({ message: 'Escolha o motivo do bloqueio.' });
  });

  it('should reject a block that ends before it starts or already passed', async () => {
    await expect(block(at(12), at(11))).rejects.toBeInstanceOf(AppError);
    await expect(block(at(6), at(7))).rejects.toBeInstanceOf(AppError);
  });

  it('should reject a block longer than the limit', async () => {
    await expect(block(at(9), new Date(2020, 8, 1, 9))).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('should reject a block for an unknown provider', async () => {
    await expect(
      createTimeBlock.execute({
        provider_ids: [providerId, 'unknown'],
        start_date: at(11),
        end_date: at(12),
        reason_id: lunchReasonId,
        requester_id: providerId,
      }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      createTimeBlock.execute({
        provider_ids: [],
        start_date: at(11),
        end_date: at(12),
        reason_id: lunchReasonId,
        requester_id: providerId,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  describe('de vários barbeiros', () => {
    let otherId: string;

    beforeEach(async () => {
      const other = await fakeUsersRepository.create({
        name: 'Carlos',
        email: 'carlos@example.test',
        password: '123456',
      });
      otherId = other.id;
    });

    it('should block the same period for every chosen provider', async () => {
      const created = await createTimeBlock.execute({
        provider_ids: [providerId, otherId],
        start_date: at(11),
        end_date: at(12),
        reason_id: lunchReasonId,
        requester_id: providerId,
      });

      expect(created.map(item => item.provider_id)).toEqual([
        providerId,
        otherId,
      ]);

      const { blocks } = await listDayAgenda.execute({
        day: 20,
        month: 5,
        year: 2020,
      });

      expect(blocks).toHaveLength(2);
    });

    it('should block nobody when one of them has appointments', async () => {
      await fakeAppointmentsRepository.create(
        makeAppointmentData({
          provider_id: otherId,
          client_id: 'client',
          date: at(11),
        }),
      );

      await expect(
        createTimeBlock.execute({
          provider_ids: [providerId, otherId],
          start_date: at(11),
          end_date: at(12),
          reason_id: lunchReasonId,
          requester_id: providerId,
        }),
      ).rejects.toMatchObject({
        message:
          'Há agendamentos neste período: Carlos (1 agendamento). Cancele ou remarque antes de bloquear.',
      });

      const { blocks } = await listDayAgenda.execute({
        day: 20,
        month: 5,
        year: 2020,
      });

      expect(blocks).toEqual([]);
    });
  });

  it('should reject a block over appointments already booked', async () => {
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: providerId,
        client_id: 'client',
        date: at(10),
      }),
    );

    await expect(block(at(10, 30), at(12))).rejects.toMatchObject({
      message:
        'Há 1 agendamento neste período. Cancele ou remarque antes de bloquear.',
    });
  });

  it('should allow blocking right after an appointment', async () => {
    await fakeAppointmentsRepository.create(
      makeAppointmentData({
        provider_id: providerId,
        client_id: 'client',
        date: at(10),
      }),
    );

    await expect(block(at(11), at(12))).resolves.toBeDefined();
  });

  it('should remove the blocked time from the free times', async () => {
    await block(at(11), at(12));

    expect(await dayTimes()).toEqual(['09:00', '10:00', '12:00']);
  });

  it('should let the buffer after an appointment run into the block', async () => {
    await agendaSettings.update({ buffer_minutes: 15 });
    await block(at(11, 15), at(13));

    // 10:15 + 60 min termina 11:15, colado ao bloqueio; o intervalo avança
    expect(await dayTimes()).toEqual(['09:00', '10:15']);
  });

  it('should not book an appointment inside a block', async () => {
    await block(at(11), at(12));

    await expect(
      createAppointment.execute({
        provider_id: providerId,
        client_id: 'client',
        service_id: haircut.id,
        date: at(10, 30),
      }),
    ).rejects.toMatchObject({
      message: 'O barbeiro não está atendendo neste horário.',
    });

    await expect(
      createAppointment.execute({
        provider_id: providerId,
        client_id: 'client',
        service_id: haircut.id,
        date: at(12),
      }),
    ).resolves.toBeDefined();
  });

  it('should mark fully blocked days as unavailable in the month', async () => {
    // Férias de quarta a sexta
    await block(at(0, 0, 20), at(0, 0, 23));

    const month = await listMonthAvailability.execute({
      provider_id: providerId,
      service_id: haircut.id,
      month: 5,
      year: 2020,
    });

    const available = (day: number): boolean | undefined =>
      month.find(item => item.day === day)?.available;

    expect(available(20)).toBe(false);
    expect(available(21)).toBe(false);
    expect(available(22)).toBe(false);
    expect(available(25)).toBe(true);
  });

  it('should list the blocks of the day in the agenda', async () => {
    const lunch = await block(at(11), at(12));
    // Outro dia: não aparece
    await block(at(11, 0, 21), at(12, 0, 21));

    const { blocks } = await listDayAgenda.execute({
      day: 20,
      month: 5,
      year: 2020,
    });

    expect(blocks).toEqual([
      {
        id: lunch.id,
        provider_id: providerId,
        start_date: at(11),
        end_date: at(12),
        reason: 'Almoço',
        recurrence: null,
      },
    ]);
  });

  it('should free the time again when the block is removed', async () => {
    const lunch = await block(at(11), at(12));

    await deleteTimeBlock.execute(lunch.id);

    expect(await dayTimes()).toEqual(['09:00', '10:00', '11:00', '12:00']);
    await expect(deleteTimeBlock.execute(lunch.id)).rejects.toBeInstanceOf(
      AppError,
    );
  });

  describe('que se repetem', () => {
    const everyDay = [0, 1, 2, 3, 4, 5, 6];
    let createRecurring: CreateRecurringTimeBlockService;

    // Repetição do barbeiro dos testes, salvo outros barbeiros em provider_ids
    const repeat = async (data: {
      provider_ids?: string[];
      days_of_week?: number[];
      start_time?: string;
      end_time?: string;
      starts_on?: string;
      ends_on?: string | null;
    }) =>
      (
        await createRecurring.execute({
          provider_ids: [providerId],
          days_of_week: everyDay,
          start_time: '11:00',
          end_time: '12:00',
          starts_on: '2020-05-20',
          reason_id: lunchReasonId,
          requester_id: providerId,
          ...data,
        })
      )[0];

    const timesOn = async (day: number, month = 5): Promise<string[]> =>
      (
        await listDayAvailability.execute({
          provider_id: providerId,
          service_id: haircut.id,
          day,
          month,
          year: 2020,
        })
      ).map(({ time }) => time);

    beforeEach(() => {
      createRecurring = new CreateRecurringTimeBlockService(
        fakeUsersRepository,
        fakeAppointmentsRepository,
        fakeTimeBlocksRepository,
        fakeBlockReasonsRepository,
      );
    });

    it('should block the same time every day with no end date', async () => {
      await repeat({ start_time: '11:00', end_time: '12:00' });

      expect(await timesOn(20)).toEqual(['09:00', '10:00', '12:00']);
      // Dias depois, continua bloqueado
      expect(await timesOn(29)).toEqual(['09:00', '10:00', '12:00']);
    });

    it('should only block the chosen weekdays, inside the dates', async () => {
      // Só às quartas (3), de 20/05 a 27/05
      await repeat({ days_of_week: [3], ends_on: '2020-05-27' });

      expect(await timesOn(20)).toEqual(['09:00', '10:00', '12:00']);
      // Quinta: livre
      expect(await timesOn(21)).toEqual(['09:00', '10:00', '11:00', '12:00']);
      expect(await timesOn(27)).toEqual(['09:00', '10:00', '12:00']);
      // Quarta depois da data final (03/06): livre
      expect(await timesOn(3, 6)).toEqual(['09:00', '10:00', '11:00', '12:00']);
    });

    it('should not book inside a repeated block', async () => {
      await repeat({});

      await expect(
        createAppointment.execute({
          provider_id: providerId,
          client_id: 'client',
          service_id: haircut.id,
          date: at(11, 0, 22),
        }),
      ).rejects.toMatchObject({
        message: 'O barbeiro não está atendendo neste horário.',
      });
    });

    it('should reject a repetition over appointments already booked', async () => {
      await fakeAppointmentsRepository.create(
        makeAppointmentData({
          provider_id: providerId,
          client_id: 'client',
          date: at(11, 30, 26),
        }),
      );

      await expect(repeat({})).rejects.toMatchObject({
        message:
          'Há 1 agendamento nesses horários (26/05 às 11:30). Cancele ou remarque antes de bloquear.',
      });
      // Em outros dias da semana, não conflita
      await expect(repeat({ days_of_week: [3] })).resolves.toBeDefined();
    });

    it('should reject invalid repetitions', async () => {
      await expect(
        repeat({ start_time: '13:00', end_time: '12:00' }),
      ).rejects.toBeInstanceOf(AppError);
      await expect(repeat({ days_of_week: [] })).rejects.toBeInstanceOf(
        AppError,
      );
      await expect(
        repeat({ starts_on: '2020-05-20', ends_on: '2020-05-19' }),
      ).rejects.toBeInstanceOf(AppError);
      await expect(
        repeat({ starts_on: '2020-05-01', ends_on: '2020-05-10' }),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('should show each day of the repetition in the agenda', async () => {
      const lunch = await repeat({ ends_on: null });

      const { blocks } = await listDayAgenda.execute({
        day: 21,
        month: 5,
        year: 2020,
      });

      expect(blocks).toEqual([
        expect.objectContaining({
          id: lunch.id,
          start_date: at(11, 0, 21),
          end_date: at(12, 0, 21),
          recurrence: expect.objectContaining({
            days_of_week: everyDay,
            ends_on: null,
          }),
        }),
      ]);
    });

    it('should repeat for several providers, each with its own repetition', async () => {
      const other = await fakeUsersRepository.create({
        name: 'Carlos',
        email: 'carlos@example.test',
        password: '123456',
      });

      const rules = await createRecurring.execute({
        provider_ids: [providerId, other.id],
        days_of_week: everyDay,
        start_time: '11:00',
        end_time: '12:00',
        starts_on: '2020-05-20',
        reason_id: lunchReasonId,
        requester_id: providerId,
      });

      expect(rules.map(rule => rule.provider_id)).toEqual([
        providerId,
        other.id,
      ]);
      expect(new Set(rules.map(rule => rule.id)).size).toBe(2);
      expect(await timesOn(21)).toEqual(['09:00', '10:00', '12:00']);
    });

    it('should remove the whole repetition', async () => {
      const lunch = await repeat({});

      await deleteTimeBlock.execute(lunch.id);

      expect(await timesOn(20)).toEqual(['09:00', '10:00', '11:00', '12:00']);
    });
  });
});
