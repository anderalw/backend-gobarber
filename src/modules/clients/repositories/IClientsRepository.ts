import Client from '../infra/typeorm/entities/Client';
import ICreateClientDTO from '../dtos/ICreateClientDTO';

export default interface IClientsRepository {
  create(data: ICreateClientDTO): Promise<Client>;
  save(client: Client): Promise<Client>;
  findByEmail(email: string): Promise<Client | undefined>;
  findById(id: string): Promise<Client | undefined>;
  // Busca por nome, e-mail ou telefone (para o barbeiro marcar pela agenda)
  search(term: string, limit: number): Promise<Client[]>;
}
