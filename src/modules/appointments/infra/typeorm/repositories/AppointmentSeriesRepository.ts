import { In, Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import IAppointmentSeriesRepository, {
  ICreateAppointmentSeriesDTO,
} from '@modules/appointments/repositories/IAppointmentSeriesRepository';

import AppointmentSeries from '../entities/AppointmentSeries';

class AppointmentSeriesRepository implements IAppointmentSeriesRepository {
  private ormRepository: Repository<AppointmentSeries>;

  constructor() {
    this.ormRepository = dataSource.getRepository(AppointmentSeries);
  }

  public async create(
    data: ICreateAppointmentSeriesDTO,
  ): Promise<AppointmentSeries> {
    const series = this.ormRepository.create(data);

    return this.ormRepository.save(series);
  }

  public async findByIds(ids: string[]): Promise<AppointmentSeries[]> {
    if (ids.length === 0) return [];

    return this.ormRepository.findBy({ id: In(ids) });
  }
}

export default AppointmentSeriesRepository;
