import IClientSummaryDTO from '@modules/appointments/dtos/IClientSummaryDTO';
import { IAddress } from '@shared/utils/documents';
import Client from '../infra/typeorm/entities/Client';

// Cliente como a barbearia vê: contatos, observações e resumo do histórico
export default interface IClientProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  notes: string | null;
  cpf: string | null;
  // 'yyyy-MM-dd'
  birth_date: string | null;
  address: IAddress | null;
  // Criou a conta no site (tem senha)
  has_account: boolean;
  created_at: Date;
  summary: Omit<IClientSummaryDTO, 'client_id'>;
  // Faltas recentes acima do limite da política de faltas
  no_show_alert: boolean;
}

export function toClientProfile(
  client: Client,
  summary: IClientSummaryDTO,
  noShowAlert: boolean,
): IClientProfile {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    notes: client.notes ?? null,
    cpf: client.cpf ?? null,
    birth_date: client.birth_date ?? null,
    address: client.address ?? null,
    has_account: !!client.password,
    created_at: client.created_at,
    summary: {
      completed: summary.completed,
      no_shows: summary.no_shows,
      recent_no_shows: summary.recent_no_shows,
      canceled: summary.canceled,
      total_cents: summary.total_cents,
      last_visit: summary.last_visit,
      next_appointment: summary.next_appointment,
    },
    no_show_alert: noShowAlert,
  };
}
