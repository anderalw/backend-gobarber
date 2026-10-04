import ClientToken from '../infra/typeorm/entities/ClientToken';

export default interface IClientTokensRepository {
  generate(client_id: string): Promise<ClientToken>;
  findByToken(token: string): Promise<ClientToken | undefined>;
  // Depois de usar: nenhum link antigo do cliente vale mais
  deleteFromClient(client_id: string): Promise<void>;
}
