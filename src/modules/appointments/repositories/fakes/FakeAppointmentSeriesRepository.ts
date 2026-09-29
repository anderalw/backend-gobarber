import { randomUUID } from 'crypto';

import IAppointmentSeriesRepository, {
  ICreateAppointmentSeriesDTO,
} from '../IAppointmentSeriesRepository';
import AppointmentSeries from '../../infra/typeorm/entities/AppointmentSeries';

class FakeAppointmentSeriesRepository implements IAppointmentSeriesRepository {
  public series: AppointmentSeries[] = [];

  public async create(
    data: ICreateAppointmentSeriesDTO,
  ): Promise<AppointmentSeries> {
    const series = Object.assign(new AppointmentSeries(), {
      id: randomUUID(),
      created_at: new Date(),
      ...data,
    });

    this.series.push(series);

    return series;
  }

  public async findByIds(ids: string[]): Promise<AppointmentSeries[]> {
    return this.series.filter(item => ids.includes(item.id));
  }
}

export default FakeAppointmentSeriesRepository;
