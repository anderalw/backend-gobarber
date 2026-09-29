import { randomUUID } from 'crypto';

import ICashClosingsRepository, {
  ISaveCashClosingDTO,
} from '../ICashClosingsRepository';
import CashClosing from '../../infra/typeorm/entities/CashClosing';

class FakeCashClosingsRepository implements ICashClosingsRepository {
  public closings: CashClosing[] = [];

  public async findByDate(date: string): Promise<CashClosing | undefined> {
    return this.closings.find(closing => closing.date === date);
  }

  public async save(data: ISaveCashClosingDTO): Promise<CashClosing> {
    const existing = await this.findByDate(data.date);

    if (existing) {
      return Object.assign(existing, data, { updated_at: new Date() });
    }

    const closing = Object.assign(new CashClosing(), {
      id: randomUUID(),
      created_at: new Date(),
      updated_at: new Date(),
      ...data,
    });

    this.closings.push(closing);

    return closing;
  }
}

export default FakeCashClosingsRepository;
