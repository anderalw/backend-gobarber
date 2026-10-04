import { Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import IClientTokensRepository from '@modules/clients/repositories/IClientTokensRepository';
import ClientToken from '../entities/ClientToken';

class ClientTokensRepository implements IClientTokensRepository {
  private ormRepository: Repository<ClientToken>;

  constructor() {
    this.ormRepository = dataSource.getRepository(ClientToken);
  }

  public async generate(client_id: string): Promise<ClientToken> {
    const clientToken = this.ormRepository.create({ client_id });

    await this.ormRepository.save(clientToken);

    return clientToken;
  }

  public async findByToken(token: string): Promise<ClientToken | undefined> {
    return (await this.ormRepository.findOneBy({ token })) ?? undefined;
  }

  public async deleteFromClient(client_id: string): Promise<void> {
    await this.ormRepository.delete({ client_id });
  }
}

export default ClientTokensRepository;
