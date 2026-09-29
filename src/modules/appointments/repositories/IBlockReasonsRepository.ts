import BlockReason from '../infra/typeorm/entities/BlockReason';

export default interface IBlockReasonsRepository {
  // Em ordem alfabética
  findAll(): Promise<BlockReason[]>;
  findById(id: string): Promise<BlockReason | undefined>;
  create(name: string): Promise<BlockReason>;
  save(reason: BlockReason): Promise<BlockReason>;
  delete(id: string): Promise<void>;
}
