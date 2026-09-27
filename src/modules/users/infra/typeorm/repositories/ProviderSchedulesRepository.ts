import { getConnection, getRepository, Repository } from 'typeorm';

import IProviderSchedulesRepository, {
  IScheduleData,
} from '@modules/users/repositories/IProviderSchedulesRepository';
import ProviderSchedule from '../entities/ProviderSchedule';

class ProviderSchedulesRepository implements IProviderSchedulesRepository {
  private ormRepository: Repository<ProviderSchedule>;

  constructor() {
    this.ormRepository = getRepository(ProviderSchedule);
  }

  public async findByProviderId(provider_id: string): Promise<ProviderSchedule[]> {
    const schedules = await this.ormRepository.find({
      where: { provider_id },
    });
    return schedules;
  }

  public async findByDayOfWeek(day_of_week: number): Promise<ProviderSchedule[]> {
    return this.ormRepository.find({ where: { day_of_week } });
  }

  public async replaceByProviderId(
    provider_id: string,
    schedules: IScheduleData[],
  ): Promise<ProviderSchedule[]> {
    // Se a gravação dos novos horários falhar, o delete é desfeito
    // e o barbeiro mantém os horários antigos
    return getConnection().transaction(async manager => {
      await manager.delete(ProviderSchedule, { provider_id });

      const newSchedules = manager.create(
        ProviderSchedule,
        schedules.map(schedule => ({ ...schedule, provider_id })),
      );

      return manager.save(newSchedules);
    });
  }
}

export default ProviderSchedulesRepository;
