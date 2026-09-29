import TimeBlock from '../infra/typeorm/entities/TimeBlock';
import RecurringTimeBlock from '../infra/typeorm/entities/RecurringTimeBlock';
import ICreateTimeBlockDTO from '../dtos/ICreateTimeBlockDTO';
import ICreateRecurringTimeBlockDTO from '../dtos/ICreateRecurringTimeBlockDTO';
import IFindTimeBlocksInRangeDTO from '../dtos/IFindTimeBlocksInRangeDTO';
import IBlockPeriod from '../dtos/IBlockPeriod';

// Bloqueios avulsos e bloqueios que se repetem
export default interface ITimeBlocksRepository {
  create(data: ICreateTimeBlockDTO): Promise<TimeBlock>;
  findById(id: string): Promise<TimeBlock | undefined>;
  delete(id: string): Promise<void>;

  createRecurring(
    data: ICreateRecurringTimeBlockDTO,
  ): Promise<RecurringTimeBlock>;
  findRecurringById(id: string): Promise<RecurringTimeBlock | undefined>;
  deleteRecurring(id: string): Promise<void>;

  // Períodos bloqueados (avulsos e os dias das repetições) que ocupam parte
  // do intervalo, do mais cedo ao mais tarde
  findInRange(data: IFindTimeBlocksInRangeDTO): Promise<IBlockPeriod[]>;
}
