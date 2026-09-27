import { uuid } from 'uuidv4';

import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import ICreateProviderScheduleDTO from '@modules/users/dtos/ICreateProviderScheduleDTO';

import ProviderSchedule from '@modules/users/infra/typeorm/entities/ProviderSchedule';

class FakeProviderSchedulesRepository implements IProviderSchedulesRepository {
  private schedules: ProviderSchedule[] = [];

  public async createMany(
    data: ICreateProviderScheduleDTO[],
  ): Promise<ProviderSchedule[]> {
    const created = data.map(scheduleData => {
      const schedule = new ProviderSchedule();

      Object.assign(schedule, { id: uuid() }, scheduleData);

      return schedule;
    });

    this.schedules.push(...created);

    return created;
  }

  public async findByProviderId(
    provider_id: string,
  ): Promise<ProviderSchedule[]> {
    return this.schedules.filter(
      schedule => schedule.provider_id === provider_id,
    );
  }

  public async deleteByProviderId(provider_id: string): Promise<void> {
    this.schedules = this.schedules.filter(
      schedule => schedule.provider_id !== provider_id,
    );
  }
}

export default FakeProviderSchedulesRepository;
