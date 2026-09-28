import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ProviderSchedule from '../infra/typeorm/entities/ProviderSchedule';
import IProviderSchedulesRepository from '../repositories/IProviderSchedulesRepository';
import IUsersRepository from '../repositories/IUsersRepository';

// 00:00 a 23:00, sempre em hora cheia
const FULL_HOUR = /^([01]\d|2[0-3]):00$/;

const DAY_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

interface ISchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface IRequest {
  provider_id: string;
  schedules: ISchedule[];
}

@injectable()
class UpdateProviderSchedulesService {
  constructor(
    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,

    @inject('UsersRepository')
    private usersRepository: IUsersRepository,
  ) {}

  public async execute({
    provider_id,
    schedules,
  }: IRequest): Promise<ProviderSchedule[]> {
    const providerExists = await this.usersRepository.findById(provider_id);

    if (!providerExists) {
      throw new AppError('Barbeiro não encontrado.');
    }

    const seenDays = new Set<number>();

    schedules.forEach(({ day_of_week, start_time, end_time }) => {
      const dayName = DAY_NAMES[day_of_week];

      if (seenDays.has(day_of_week)) {
        throw new AppError(`${dayName} aparece mais de uma vez nos horários.`);
      }
      seenDays.add(day_of_week);

      // A agenda trabalha em blocos de 1 hora (ver ListProviderDayAvailability)
      if (!FULL_HOUR.test(start_time) || !FULL_HOUR.test(end_time)) {
        throw new AppError(
          `Horário inválido em ${dayName}: use horas cheias no formato HH:00.`,
        );
      }

      if (start_time >= end_time) {
        throw new AppError(
          `Em ${dayName}, o horário de início deve ser antes do horário de fim.`,
        );
      }
    });

    const schedulesData = schedules.map(schedule => ({
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    }));

    // Apaga os horários antigos e grava os novos numa única transação
    const createdSchedules =
      await this.providerSchedulesRepository.replaceByProviderId(
        provider_id,
        schedulesData,
      );

    return createdSchedules;
  }
}

export default UpdateProviderSchedulesService;
