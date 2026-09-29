import {
  Repository,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
} from 'typeorm';
import { format } from 'date-fns';

import dataSource from '@shared/infra/typeorm/dataSource';
import ITimeBlocksRepository from '@modules/appointments/repositories/ITimeBlocksRepository';
import ICreateTimeBlockDTO from '@modules/appointments/dtos/ICreateTimeBlockDTO';
import ICreateRecurringTimeBlockDTO from '@modules/appointments/dtos/ICreateRecurringTimeBlockDTO';
import IFindTimeBlocksInRangeDTO from '@modules/appointments/dtos/IFindTimeBlocksInRangeDTO';
import IBlockPeriod from '@modules/appointments/dtos/IBlockPeriod';
import expandRecurringBlocks from '@modules/appointments/utils/expandRecurringBlocks';

import TimeBlock from '../entities/TimeBlock';
import RecurringTimeBlock from '../entities/RecurringTimeBlock';

class TimeBlocksRepository implements ITimeBlocksRepository {
  private ormRepository: Repository<TimeBlock>;

  private recurringRepository: Repository<RecurringTimeBlock>;

  constructor() {
    this.ormRepository = dataSource.getRepository(TimeBlock);
    this.recurringRepository = dataSource.getRepository(RecurringTimeBlock);
  }

  public async create(data: ICreateTimeBlockDTO): Promise<TimeBlock> {
    const block = this.ormRepository.create(data);

    await this.ormRepository.save(block);

    return block;
  }

  public async findById(id: string): Promise<TimeBlock | undefined> {
    // Sem id o TypeORM 0.3 ignoraria o filtro e traria o primeiro registro
    if (!id) return undefined;

    const block = await this.ormRepository.findOneBy({ id });

    return block ?? undefined;
  }

  public async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  public async createRecurring(
    data: ICreateRecurringTimeBlockDTO,
  ): Promise<RecurringTimeBlock> {
    const rule = this.recurringRepository.create(data);

    await this.recurringRepository.save(rule);

    return rule;
  }

  public async findRecurringById(
    id: string,
  ): Promise<RecurringTimeBlock | undefined> {
    if (!id) return undefined;

    const rule = await this.recurringRepository.findOneBy({ id });

    return rule ?? undefined;
  }

  public async deleteRecurring(id: string): Promise<void> {
    await this.recurringRepository.delete(id);
  }

  public async findInRange({
    provider_id,
    start,
    end,
  }: IFindTimeBlocksInRangeDTO): Promise<IBlockPeriod[]> {
    const byProvider = provider_id ? { provider_id } : {};

    // Repetições em vigor em algum dia do intervalo
    const inEffect = {
      ...byProvider,
      starts_on: LessThanOrEqual(format(end, 'yyyy-MM-dd')),
    };

    const [blocks, rules] = await Promise.all([
      // Sobrepõe se começa antes do fim do intervalo e termina depois do início
      this.ormRepository.find({
        where: {
          ...byProvider,
          start_date: LessThan(end),
          end_date: MoreThan(start),
        },
      }),
      this.recurringRepository.find({
        where: [
          { ...inEffect, ends_on: IsNull() },
          {
            ...inEffect,
            ends_on: MoreThanOrEqual(format(start, 'yyyy-MM-dd')),
          },
        ],
      }),
    ]);

    return [
      ...blocks.map(block => ({
        id: block.id,
        provider_id: block.provider_id,
        start_date: block.start_date,
        end_date: block.end_date,
        reason: block.reason,
        recurrence: null,
      })),
      ...expandRecurringBlocks(rules, start, end),
    ].sort((a, b) => a.start_date.getTime() - b.start_date.getTime());
  }
}

export default TimeBlocksRepository;
