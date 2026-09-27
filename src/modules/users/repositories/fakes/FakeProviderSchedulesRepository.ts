import { uuid } from 'uuidv4';

import IProviderSchedulesRepository, {
  IScheduleData,
} from '@modules/users/repositories/IProviderSchedulesRepository';

import ProviderSchedule from '@modules/users/infra/typeorm/entities/ProviderSchedule';

class FakeProviderSchedulesRepository implements IProviderSchedulesRepository {
  private schedules: ProviderSchedule[] = [];

  public async findByProviderId(
    provider_id: string,
  ): Promise<ProviderSchedule[]> {
    return this.schedules.filter(
      schedule => schedule.provider_id === provider_id,
    );
  }

  public async findByDayOfWeek(
    day_of_week: number,
  ): Promise<ProviderSchedule[]> {
    return this.schedules.filter(
      schedule => schedule.day_of_week === day_of_week,
    );
  }

  public async replaceByProviderId(
    provider_id: string,
    schedules: IScheduleData[],
  ): Promise<ProviderSchedule[]> {
    const created = schedules.map(scheduleData => {
      const schedule = new ProviderSchedule();

      Object.assign(schedule, { id: uuid(), provider_id }, scheduleData);

      return schedule;
    });

    this.schedules = this.schedules
      .filter(schedule => schedule.provider_id !== provider_id)
      .concat(created);

    return created;
  }
}

export default FakeProviderSchedulesRepository;
