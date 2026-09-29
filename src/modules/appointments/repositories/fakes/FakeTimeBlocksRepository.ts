import { randomUUID } from 'crypto';
import { isAfter, isBefore } from 'date-fns';

import ITimeBlocksRepository from '@modules/appointments/repositories/ITimeBlocksRepository';
import ICreateTimeBlockDTO from '@modules/appointments/dtos/ICreateTimeBlockDTO';
import IFindTimeBlocksInRangeDTO from '@modules/appointments/dtos/IFindTimeBlocksInRangeDTO';

import TimeBlock from '../../infra/typeorm/entities/TimeBlock';

class FakeTimeBlocksRepository implements ITimeBlocksRepository {
  private blocks: TimeBlock[] = [];

  public async create(data: ICreateTimeBlockDTO): Promise<TimeBlock> {
    const block = new TimeBlock();

    Object.assign(block, data, { id: randomUUID(), created_at: new Date() });

    this.blocks.push(block);

    return block;
  }

  public async findById(id: string): Promise<TimeBlock | undefined> {
    return this.blocks.find(block => block.id === id);
  }

  public async delete(id: string): Promise<void> {
    this.blocks = this.blocks.filter(block => block.id !== id);
  }

  public async findInRange({
    provider_id,
    start,
    end,
  }: IFindTimeBlocksInRangeDTO): Promise<TimeBlock[]> {
    return this.blocks
      .filter(
        block =>
          (!provider_id || block.provider_id === provider_id) &&
          isBefore(block.start_date, end) &&
          isAfter(block.end_date, start),
      )
      .sort((a, b) => a.start_date.getTime() - b.start_date.getTime());
  }
}

export default FakeTimeBlocksRepository;
