import CashClosing from '../infra/typeorm/entities/CashClosing';

export type ISaveCashClosingDTO = Omit<
  CashClosing,
  'id' | 'created_at' | 'updated_at'
>;

export default interface ICashClosingsRepository {
  findByDate(date: string): Promise<CashClosing | undefined>;
  // Cria ou substitui o fechamento do dia
  save(data: ISaveCashClosingDTO): Promise<CashClosing>;
}
