import { Between, Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import ISessionPackagesRepository, {
  ICreateSessionPackageDTO,
} from '@modules/packages/repositories/ISessionPackagesRepository';

import SessionPackage from '../entities/SessionPackage';

class SessionPackagesRepository implements ISessionPackagesRepository {
  private ormRepository: Repository<SessionPackage>;

  constructor() {
    this.ormRepository = dataSource.getRepository(SessionPackage);
  }

  public async create(data: ICreateSessionPackageDTO): Promise<SessionPackage> {
    return this.ormRepository.save(this.ormRepository.create(data));
  }

  public async save(item: SessionPackage): Promise<SessionPackage> {
    return this.ormRepository.save(item);
  }

  public async findById(id: string): Promise<SessionPackage | undefined> {
    if (!id) return undefined;

    return (
      (await this.ormRepository.findOne({
        where: { id },
        relations: ['client', 'service'],
      })) || undefined
    );
  }

  public async findByClient(client_id: string): Promise<SessionPackage[]> {
    if (!client_id) return [];

    return this.ormRepository.find({
      where: { client_id },
      relations: ['service'],
      order: { paid_at: 'ASC' },
    });
  }

  public async findPaidInPeriod(
    start: Date,
    end: Date,
  ): Promise<SessionPackage[]> {
    return this.ormRepository.find({
      where: { paid_at: Between(start, end) },
      relations: ['client', 'service'],
      order: { paid_at: 'ASC' },
    });
  }
}

export default SessionPackagesRepository;
