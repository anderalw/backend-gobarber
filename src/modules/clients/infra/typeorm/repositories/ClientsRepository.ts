import { ILike, In, Repository } from 'typeorm';
import dataSource from '@shared/infra/typeorm/dataSource';
import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import ICreateClientDTO from '@modules/clients/dtos/ICreateClientDTO';
import Client from '../entities/Client';

class ClientsRepository implements IClientsRepository {
  private ormRepository: Repository<Client>;

  constructor() {
    this.ormRepository = dataSource.getRepository(Client);
  }

  public async findByCpf(cpf: string): Promise<Client | undefined> {
    if (!cpf) return undefined;

    return (await this.ormRepository.findOneBy({ cpf })) ?? undefined;
  }

  public async findByEmail(email: string): Promise<Client | undefined> {
    const client = await this.ormRepository.findOneBy({ email });
    return client ?? undefined;
  }

  public async findById(id: string): Promise<Client | undefined> {
    if (!id) return undefined;

    return (await this.ormRepository.findOneBy({ id })) ?? undefined;
  }

  public async findByGoogleId(google_id: string): Promise<Client | undefined> {
    if (!google_id) return undefined;

    return (await this.ormRepository.findOneBy({ google_id })) ?? undefined;
  }

  public async findByIds(ids: string[]): Promise<Client[]> {
    if (ids.length === 0) return [];

    return this.ormRepository.findBy({ id: In(ids) });
  }

  public async search(term: string, limit: number): Promise<Client[]> {
    // Os curingas do LIKE digitados pelo usuário valem como texto
    const pattern = `%${term.replace(/[\\%_]/g, char => `\\${char}`)}%`;

    return this.ormRepository.find({
      where: [
        { name: ILike(pattern) },
        { email: ILike(pattern) },
        { phone: ILike(pattern) },
      ],
      order: { name: 'ASC' },
      take: limit,
    });
  }

  public async list({
    search,
    offset,
    limit,
  }: {
    search: string;
    offset: number;
    limit: number;
  }): Promise<{ clients: Client[]; total: number }> {
    const pattern = `%${search.replace(/[\\%_]/g, char => `\\${char}`)}%`;
    const where = search
      ? [
          { name: ILike(pattern) },
          { email: ILike(pattern) },
          { phone: ILike(pattern) },
        ]
      : undefined;

    const [clients, total] = await this.ormRepository.findAndCount({
      where,
      order: { name: 'ASC', id: 'ASC' },
      skip: offset,
      take: limit,
    });

    return { clients, total };
  }

  public async save(client: Client): Promise<Client> {
    return this.ormRepository.save(client);
  }

  public async create(clientData: ICreateClientDTO): Promise<Client> {
    const client = this.ormRepository.create(clientData);
    await this.ormRepository.save(client);
    return client;
  }
}

export default ClientsRepository;
