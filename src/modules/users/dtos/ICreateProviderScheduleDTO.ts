export default interface ICreateProviderScheduleDTO {
  provider_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}