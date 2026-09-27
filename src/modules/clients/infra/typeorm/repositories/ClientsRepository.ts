import { getRepository, Repository } from 'typeorm';
import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import Client from '../entities/Client';

class ClientsRepository implements IClientsRepository {
  private ormRepository: Repository<Client>;

  constructor() {
    this.ormRepository = getRepository(Client);
  }

  public async findByEmail(email: string): Promise<Client | undefined> {
    const client = await this.ormRepository.findOne({ where: { email } });
    return client;
  }

  public async create(userData: any): Promise<Client> {
    const client = this.ormRepository.create(userData);
    await this.ormRepository.save(client);
    return client;
  }
}

export default ClientsRepository;