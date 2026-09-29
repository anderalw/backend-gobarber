import TimeBlock from '../infra/typeorm/entities/TimeBlock';
import ICreateTimeBlockDTO from '../dtos/ICreateTimeBlockDTO';
import IFindTimeBlocksInRangeDTO from '../dtos/IFindTimeBlocksInRangeDTO';

export default interface ITimeBlocksRepository {
  create(data: ICreateTimeBlockDTO): Promise<TimeBlock>;
  findById(id: string): Promise<TimeBlock | undefined>;
  delete(id: string): Promise<void>;
  // Bloqueios que ocupam parte do intervalo, do mais cedo ao mais tarde
  findInRange(data: IFindTimeBlocksInRangeDTO): Promise<TimeBlock[]>;
}
