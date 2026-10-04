import { randomUUID } from 'crypto';

import ISessionPackagesRepository, {
  ICreateSessionPackageDTO,
} from '../ISessionPackagesRepository';
import SessionPackage from '../../infra/typeorm/entities/SessionPackage';

class FakeSessionPackagesRepository implements ISessionPackagesRepository {
  public packages: SessionPackage[] = [];

  public async create(data: ICreateSessionPackageDTO): Promise<SessionPackage> {
    const item = Object.assign(new SessionPackage(), data, {
      id: randomUUID(),
      canceled_at: null,
      created_at: new Date(Date.now()),
      updated_at: new Date(Date.now()),
    });

    this.packages.push(item);

    return item;
  }

  public async save(item: SessionPackage): Promise<SessionPackage> {
    const index = this.packages.findIndex(entry => entry.id === item.id);

    this.packages[index] = item;

    return item;
  }

  public async findById(id: string): Promise<SessionPackage | undefined> {
    return this.packages.find(item => item.id === id);
  }

  public async findByClient(client_id: string): Promise<SessionPackage[]> {
    return this.packages
      .filter(item => item.client_id === client_id)
      .sort((a, b) => a.paid_at.getTime() - b.paid_at.getTime());
  }

  public async findPaidInPeriod(
    start: Date,
    end: Date,
  ): Promise<SessionPackage[]> {
    return this.packages.filter(
      item => item.paid_at >= start && item.paid_at <= end,
    );
  }
}

export default FakeSessionPackagesRepository;
