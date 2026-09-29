import AppointmentSeries from '../infra/typeorm/entities/AppointmentSeries';

export interface ICreateAppointmentSeriesDTO {
  client_id: string;
  provider_id: string;
  service_id: string;
  interval_weeks: number;
  created_by: string;
}

export default interface IAppointmentSeriesRepository {
  create(data: ICreateAppointmentSeriesDTO): Promise<AppointmentSeries>;
  findByIds(ids: string[]): Promise<AppointmentSeries[]>;
}
