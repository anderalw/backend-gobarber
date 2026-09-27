import ProviderSchedule from '../infra/typeorm/entities/ProviderSchedule';
import ICreateProviderScheduleDTO from '../dtos/ICreateProviderScheduleDTO';

export type IScheduleData = Omit<ICreateProviderScheduleDTO, 'provider_id'>;

export default interface IProviderSchedulesRepository {
  findByProviderId(provider_id: string): Promise<ProviderSchedule[]>;
  // Substitui todos os horários do barbeiro de uma só vez (tudo ou nada)
  replaceByProviderId(
    provider_id: string,
    schedules: IScheduleData[],
  ): Promise<ProviderSchedule[]>;
}
