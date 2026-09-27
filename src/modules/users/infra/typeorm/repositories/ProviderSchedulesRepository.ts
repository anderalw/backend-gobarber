import { getRepository, Repository } from 'typeorm';

import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import ICreateProviderScheduleDTO from '@modules/users/dtos/ICreateProviderScheduleDTO';
import ProviderSchedule from '../entities/ProviderSchedule';

class ProviderSchedulesRepository implements IProviderSchedulesRepository {
  private ormRepository: Repository<ProviderSchedule>;

  constructor() {
    this.ormRepository = getRepository(ProviderSchedule);
  }

  public async createMany(data: ICreateProviderScheduleDTO[]): Promise<ProviderSchedule[]> {
    const schedules = this.ormRepository.create(data);
    await this.ormRepository.save(schedules);
    return schedules;
  }

  public async findByProviderId(provider_id: string): Promise<ProviderSchedule[]> {
    const schedules = await this.ormRepository.find({
      where: { provider_id },
    });
    return schedules;
  }

  public async deleteByProviderId(provider_id: string): Promise<void> {
    await this.ormRepository.delete({ provider_id });
  }
}

export default ProviderSchedulesRepository;