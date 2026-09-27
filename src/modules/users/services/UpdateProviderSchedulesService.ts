import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ProviderSchedule from '../infra/typeorm/entities/ProviderSchedule';
import IProviderSchedulesRepository from '../repositories/IProviderSchedulesRepository';
import IUsersRepository from '../repositories/IUsersRepository';

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

  public async execute({ provider_id, schedules }: IRequest): Promise<ProviderSchedule[]> {
    const providerExists = await this.usersRepository.findById(provider_id);

    if (!providerExists) {
      throw new AppError('Barbeiro não encontrado.');
    }

    const schedulesData = schedules.map(schedule => ({
      day_of_week: schedule.day_of_week,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    }));

    // Apaga os horários antigos e grava os novos numa única transação
    const createdSchedules = await this.providerSchedulesRepository.replaceByProviderId(
      provider_id,
      schedulesData,
    );

    return createdSchedules;
  }
}

export default UpdateProviderSchedulesService;