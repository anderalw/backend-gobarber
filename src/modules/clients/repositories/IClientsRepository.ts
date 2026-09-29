import Client from '../infra/typeorm/entities/Client';
import ICreateClientDTO from '../dtos/ICreateClientDTO';

export default interface IClientsRepository {
  create(data: ICreateClientDTO): Promise<Client>;
  save(client: Client): Promise<Client>;
  findByEmail(email: string): Promise<Client | undefined>;
  findById(id: string): Promise<Client | undefined>;
  findByGoogleId(google_id: string): Promise<Client | undefined>;
  findByIds(ids: string[]): Promise<Client[]>;
  // Busca por nome, e-mail ou telefone (para o barbeiro marcar pela agenda)
  search(term: string, limit: number): Promise<Client[]>;
  // Página da lista de clientes em ordem de nome; search vazio = todos
  list(options: {
    search: string;
    offset: number;
    limit: number;
  }): Promise<{ clients: Client[]; total: number }>;
}
