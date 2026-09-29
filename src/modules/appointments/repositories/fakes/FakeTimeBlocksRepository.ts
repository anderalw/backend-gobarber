import { randomUUID } from 'crypto';
import { isAfter, isBefore } from 'date-fns';

import ITimeBlocksRepository from '@modules/appointments/repositories/ITimeBlocksRepository';
import ICreateTimeBlockDTO from '@modules/appointments/dtos/ICreateTimeBlockDTO';
import ICreateRecurringTimeBlockDTO from '@modules/appointments/dtos/ICreateRecurringTimeBlockDTO';
import IFindTimeBlocksInRangeDTO from '@modules/appointments/dtos/IFindTimeBlocksInRangeDTO';
import IBlockPeriod from '@modules/appointments/dtos/IBlockPeriod';
import expandRecurringBlocks from '@modules/appointments/utils/expandRecurringBlocks';

import TimeBlock from '../../infra/typeorm/entities/TimeBlock';
import RecurringTimeBlock from '../../infra/typeorm/entities/RecurringTimeBlock';

class FakeTimeBlocksRepository implements ITimeBlocksRepository {
  private blocks: TimeBlock[] = [];

  private rules: RecurringTimeBlock[] = [];

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

  public async createRecurring(
    data: ICreateRecurringTimeBlockDTO,
  ): Promise<RecurringTimeBlock> {
    const rule = new RecurringTimeBlock();

    Object.assign(rule, data, { id: randomUUID(), created_at: new Date() });

    this.rules.push(rule);

    return rule;
  }

  public async findRecurringById(
    id: string,
  ): Promise<RecurringTimeBlock | undefined> {
    return this.rules.find(rule => rule.id === id);
  }

  public async deleteRecurring(id: string): Promise<void> {
    this.rules = this.rules.filter(rule => rule.id !== id);
  }

  public async findInRange({
    provider_id,
    start,
    end,
  }: IFindTimeBlocksInRangeDTO): Promise<IBlockPeriod[]> {
    const blocks = this.blocks
      .filter(
        block =>
          (!provider_id || block.provider_id === provider_id) &&
          isBefore(block.start_date, end) &&
          isAfter(block.end_date, start),
      )
      .map(block => ({
        id: block.id,
        provider_id: block.provider_id,
        start_date: block.start_date,
        end_date: block.end_date,
        reason: block.reason,
        recurrence: null,
      }));

    const rules = this.rules.filter(
      rule => !provider_id || rule.provider_id === provider_id,
    );

    return [...blocks, ...expandRecurringBlocks(rules, start, end)].sort(
      (a, b) => a.start_date.getTime() - b.start_date.getTime(),
    );
  }
}

export default FakeTimeBlocksRepository;
