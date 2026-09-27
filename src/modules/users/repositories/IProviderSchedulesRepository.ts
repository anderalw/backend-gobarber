import ProviderSchedule from '../infra/typeorm/entities/ProviderSchedule';
import ICreateProviderScheduleDTO from '../dtos/ICreateProviderScheduleDTO';

export default interface IProviderSchedulesRepository {
  createMany(data: ICreateProviderScheduleDTO[]): Promise<ProviderSchedule[]>;
  findByProviderId(provider_id: string): Promise<ProviderSchedule[]>;
  deleteByProviderId(provider_id: string): Promise<void>;
}