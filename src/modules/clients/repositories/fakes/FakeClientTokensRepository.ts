import { randomUUID } from 'crypto';

import IClientTokensRepository from '@modules/clients/repositories/IClientTokensRepository';
import ClientToken from '../../infra/typeorm/entities/ClientToken';

class FakeClientTokensRepository implements IClientTokensRepository {
  private tokens: ClientToken[] = [];

  public async generate(client_id: string): Promise<ClientToken> {
    const clientToken = new ClientToken();

    Object.assign(clientToken, {
      id: randomUUID(),
      token: randomUUID(),
      client_id,
      created_at: new Date(Date.now()),
      updated_at: new Date(Date.now()),
    });

    this.tokens.push(clientToken);

    return clientToken;
  }

  public async findByToken(token: string): Promise<ClientToken | undefined> {
    return this.tokens.find(item => item.token === token);
  }

  public async deleteFromClient(client_id: string): Promise<void> {
    this.tokens = this.tokens.filter(item => item.client_id !== client_id);
  }
}

export default FakeClientTokensRepository;
