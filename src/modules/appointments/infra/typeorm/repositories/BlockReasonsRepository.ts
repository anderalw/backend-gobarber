import { Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import IBlockReasonsRepository from '@modules/appointments/repositories/IBlockReasonsRepository';

import BlockReason from '../entities/BlockReason';

class BlockReasonsRepository implements IBlockReasonsRepository {
  private ormRepository: Repository<BlockReason>;

  constructor() {
    this.ormRepository = dataSource.getRepository(BlockReason);
  }

  public async findAll(): Promise<BlockReason[]> {
    const reasons = await this.ormRepository.find();

    return reasons.sort((a, b) => a.name.localeCompare(b.name));
  }

  public async findById(id: string): Promise<BlockReason | undefined> {
    // Sem id o TypeORM 0.3 ignoraria o filtro e traria o primeiro registro
    if (!id) return undefined;

    const reason = await this.ormRepository.findOneBy({ id });

    return reason ?? undefined;
  }

  public async create(name: string): Promise<BlockReason> {
    const reason = this.ormRepository.create({ name });

    await this.ormRepository.save(reason);

    return reason;
  }

  public async save(reason: BlockReason): Promise<BlockReason> {
    return this.ormRepository.save(reason);
  }

  public async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }
}

export default BlockReasonsRepository;
