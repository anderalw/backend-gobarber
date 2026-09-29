import { MoreThanOrEqual, Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import IWaitlistRepository, {
  ICreateWaitlistEntryDTO,
} from '@modules/appointments/repositories/IWaitlistRepository';

import WaitlistEntry from '../entities/WaitlistEntry';

class WaitlistRepository implements IWaitlistRepository {
  private ormRepository: Repository<WaitlistEntry>;

  constructor() {
    this.ormRepository = dataSource.getRepository(WaitlistEntry);
  }

  public async create(data: ICreateWaitlistEntryDTO): Promise<WaitlistEntry> {
    const entry = this.ormRepository.create(data);

    return this.ormRepository.save(entry);
  }

  public async save(entry: WaitlistEntry): Promise<WaitlistEntry> {
    return this.ormRepository.save(entry);
  }

  public async findById(id: string): Promise<WaitlistEntry | undefined> {
    // Sem id o TypeORM 0.3 ignoraria o filtro e traria o primeiro registro
    if (!id) return undefined;

    return (await this.ormRepository.findOneBy({ id })) ?? undefined;
  }

  public async findWaitingByDate(date: string): Promise<WaitlistEntry[]> {
    return this.ormRepository.find({
      where: { date, status: 'waiting' },
      relations: ['client', 'provider', 'service'],
      order: { created_at: 'ASC' },
    });
  }

  public async findWaitingByClientAndDate(
    client_id: string,
    date: string,
  ): Promise<WaitlistEntry | undefined> {
    if (!client_id) return undefined;

    return (
      (await this.ormRepository.findOneBy({
        client_id,
        date,
        status: 'waiting',
      })) ?? undefined
    );
  }

  public async findWaitingByClient(
    client_id: string,
    from: string,
  ): Promise<WaitlistEntry[]> {
    if (!client_id) return [];

    return this.ormRepository.find({
      where: { client_id, status: 'waiting', date: MoreThanOrEqual(from) },
      relations: ['provider', 'service'],
      order: { date: 'ASC' },
    });
  }
}

export default WaitlistRepository;
