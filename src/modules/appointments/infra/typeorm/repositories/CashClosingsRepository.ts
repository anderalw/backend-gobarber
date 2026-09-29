import { Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import ICashClosingsRepository, {
  ISaveCashClosingDTO,
} from '@modules/appointments/repositories/ICashClosingsRepository';

import CashClosing from '../entities/CashClosing';

class CashClosingsRepository implements ICashClosingsRepository {
  private ormRepository: Repository<CashClosing>;

  constructor() {
    this.ormRepository = dataSource.getRepository(CashClosing);
  }

  public async findByDate(date: string): Promise<CashClosing | undefined> {
    if (!date) return undefined;

    return (await this.ormRepository.findOneBy({ date })) ?? undefined;
  }

  public async save(data: ISaveCashClosingDTO): Promise<CashClosing> {
    const existing = await this.findByDate(data.date);
    const closing = existing
      ? Object.assign(existing, data)
      : this.ormRepository.create(data);

    return this.ormRepository.save(closing);
  }
}

export default CashClosingsRepository;
