import { randomUUID } from 'crypto';

import IBlockReasonsRepository from '@modules/appointments/repositories/IBlockReasonsRepository';

import BlockReason from '../../infra/typeorm/entities/BlockReason';

class FakeBlockReasonsRepository implements IBlockReasonsRepository {
  private reasons: BlockReason[] = [];

  public async findAll(): Promise<BlockReason[]> {
    return [...this.reasons].sort((a, b) => a.name.localeCompare(b.name));
  }

  public async findById(id: string): Promise<BlockReason | undefined> {
    return this.reasons.find(reason => reason.id === id);
  }

  public async create(name: string): Promise<BlockReason> {
    const reason = new BlockReason();

    Object.assign(reason, {
      id: randomUUID(),
      name,
      created_at: new Date(),
      updated_at: new Date(),
    });

    this.reasons.push(reason);

    return reason;
  }

  public async save(reason: BlockReason): Promise<BlockReason> {
    const index = this.reasons.findIndex(item => item.id === reason.id);

    this.reasons[index] = reason;

    return reason;
  }

  public async delete(id: string): Promise<void> {
    this.reasons = this.reasons.filter(reason => reason.id !== id);
  }
}

export default FakeBlockReasonsRepository;
