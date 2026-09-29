import { Repository, LessThan, MoreThan } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import ITimeBlocksRepository from '@modules/appointments/repositories/ITimeBlocksRepository';
import ICreateTimeBlockDTO from '@modules/appointments/dtos/ICreateTimeBlockDTO';
import IFindTimeBlocksInRangeDTO from '@modules/appointments/dtos/IFindTimeBlocksInRangeDTO';

import TimeBlock from '../entities/TimeBlock';

class TimeBlocksRepository implements ITimeBlocksRepository {
  private ormRepository: Repository<TimeBlock>;

  constructor() {
    this.ormRepository = dataSource.getRepository(TimeBlock);
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

  public async findInRange({
    provider_id,
    start,
    end,
  }: IFindTimeBlocksInRangeDTO): Promise<TimeBlock[]> {
    // Sobrepõe se começa antes do fim do intervalo e termina depois do início
    return this.ormRepository.find({
      where: {
        ...(provider_id && { provider_id }),
        start_date: LessThan(end),
        end_date: MoreThan(start),
      },
      order: { start_date: 'ASC' },
    });
  }
}

export default TimeBlocksRepository;
