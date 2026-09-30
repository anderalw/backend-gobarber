import Membership, {
  MembershipStatus,
} from '../infra/typeorm/entities/Membership';

export interface ICreateMembershipDTO {
  client_id: string;
  plan_id: string;
  status: MembershipStatus;
  cycle_anchor?: string | null;
  paid_until?: string | null;
  requested_at?: Date | null;
  started_at?: Date | null;
  created_by?: string | null;
}

// As buscas trazem o cliente e o plano
export default interface IMembershipsRepository {
  create(data: ICreateMembershipDTO): Promise<Membership>;
  save(membership: Membership): Promise<Membership>;
  findById(id: string): Promise<Membership | undefined>;
  // Pedida ou ativa (um cliente tem no máximo uma)
  findCurrentByClient(client_id: string): Promise<Membership | undefined>;
  findByStatus(statuses: MembershipStatus[]): Promise<Membership[]>;
  // Canceladas a partir de uma data (para o resumo do clube)
  findCanceledSince(date: Date): Promise<Membership[]>;
}
