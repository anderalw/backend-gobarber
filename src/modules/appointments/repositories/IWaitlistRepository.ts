import WaitlistEntry, {
  WaitlistPeriod,
} from '../infra/typeorm/entities/WaitlistEntry';

export interface ICreateWaitlistEntryDTO {
  client_id: string;
  date: string;
  provider_id: string | null;
  service_id: string | null;
  period: WaitlistPeriod;
  notes: string | null;
  created_by: 'provider' | 'client';
  created_by_user: string | null;
}

export default interface IWaitlistRepository {
  create(data: ICreateWaitlistEntryDTO): Promise<WaitlistEntry>;
  save(entry: WaitlistEntry): Promise<WaitlistEntry>;
  findById(id: string): Promise<WaitlistEntry | undefined>;
  // Quem está esperando no dia ('yyyy-MM-dd'), na ordem em que entrou, com
  // cliente, barbeiro e serviço
  findWaitingByDate(date: string): Promise<WaitlistEntry[]>;
  // O cliente já está esperando neste dia?
  findWaitingByClientAndDate(
    client_id: string,
    date: string,
  ): Promise<WaitlistEntry | undefined>;
  // Dias a partir de from em que o cliente está esperando, com barbeiro e
  // serviço
  findWaitingByClient(
    client_id: string,
    from: string,
  ): Promise<WaitlistEntry[]>;
}
