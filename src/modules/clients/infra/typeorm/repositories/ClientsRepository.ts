import { getRepository, Repository } from 'typeorm';
import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import ICreateClientDTO from '@modules/clients/dtos/ICreateClientDTO';
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

  public async create(clientData: ICreateClientDTO): Promise<Client> {
    const client = this.ormRepository.create(clientData);
    await this.ormRepository.save(client);
    return client;
  }
}

export default ClientsRepository;