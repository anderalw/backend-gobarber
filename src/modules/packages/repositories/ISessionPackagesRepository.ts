import SessionPackage from '../infra/typeorm/entities/SessionPackage';

export type ICreateSessionPackageDTO = Pick<
  SessionPackage,
  | 'client_id'
  | 'service_id'
  | 'sessions'
  | 'price_cents'
  | 'payment_method'
  | 'paid_at'
  | 'received_by'
>;

export default interface ISessionPackagesRepository {
  create(data: ICreateSessionPackageDTO): Promise<SessionPackage>;
  save(item: SessionPackage): Promise<SessionPackage>;
  // Com cliente e serviço
  findById(id: string): Promise<SessionPackage | undefined>;
  // Do mais antigo ao mais recente, inclusive cancelados, com o serviço
  findByClient(client_id: string): Promise<SessionPackage[]>;
  // Vendidos no período, com cliente e serviço (para o caixa)
  findPaidInPeriod(start: Date, end: Date): Promise<SessionPackage[]>;
}
