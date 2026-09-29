import { randomUUID } from 'crypto';

import IWaitlistRepository, {
  ICreateWaitlistEntryDTO,
} from '../IWaitlistRepository';
import WaitlistEntry from '../../infra/typeorm/entities/WaitlistEntry';

class FakeWaitlistRepository implements IWaitlistRepository {
  public entries: WaitlistEntry[] = [];

  public async create(data: ICreateWaitlistEntryDTO): Promise<WaitlistEntry> {
    const entry = Object.assign(new WaitlistEntry(), {
      id: randomUUID(),
      status: 'waiting',
      notified_at: null,
      // Em ordem de chegada, mesmo criando vários no mesmo milissegundo
      created_at: new Date(Date.now() + this.entries.length),
      updated_at: new Date(),
      ...data,
    });

    this.entries.push(entry);

    return entry;
  }

  public async save(entry: WaitlistEntry): Promise<WaitlistEntry> {
    const index = this.entries.findIndex(item => item.id === entry.id);

    this.entries[index] = entry;

    return entry;
  }

  public async findById(id: string): Promise<WaitlistEntry | undefined> {
    return this.entries.find(entry => entry.id === id);
  }

  public async findWaitingByDate(date: string): Promise<WaitlistEntry[]> {
    return this.entries
      .filter(entry => entry.date === date && entry.status === 'waiting')
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  }

  public async findWaitingByClientAndDate(
    client_id: string,
    date: string,
  ): Promise<WaitlistEntry | undefined> {
    return this.entries.find(
      entry =>
        entry.client_id === client_id &&
        entry.date === date &&
        entry.status === 'waiting',
    );
  }

  public async findWaitingByClient(
    client_id: string,
    from: string,
  ): Promise<WaitlistEntry[]> {
    return this.entries
      .filter(
        entry =>
          entry.client_id === client_id &&
          entry.status === 'waiting' &&
          entry.date >= from,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export default FakeWaitlistRepository;
