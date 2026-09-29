import { randomUUID } from 'crypto';

import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import ICreateClientDTO from '@modules/clients/dtos/ICreateClientDTO';
import Client from '../../infra/typeorm/entities/Client';

class FakeClientsRepository implements IClientsRepository {
  private clients: Client[] = [];

  public async create(data: ICreateClientDTO): Promise<Client> {
    const client = new Client();

    Object.assign(client, { id: randomUUID() }, data);

    this.clients.push(client);

    return client;
  }

  public async save(client: Client): Promise<Client> {
    const index = this.clients.findIndex(item => item.id === client.id);

    this.clients[index] = client;

    return client;
  }

  public async findByEmail(email: string): Promise<Client | undefined> {
    return this.clients.find(client => client.email === email);
  }

  public async findById(id: string): Promise<Client | undefined> {
    return this.clients.find(client => client.id === id);
  }

  public async findByIds(ids: string[]): Promise<Client[]> {
    return this.clients.filter(client => ids.includes(client.id));
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
    const all = search
      ? await this.search(search, Number.MAX_SAFE_INTEGER)
      : [...this.clients].sort((a, b) => a.name.localeCompare(b.name));

    return { clients: all.slice(offset, offset + limit), total: all.length };
  }

  public async search(term: string, limit: number): Promise<Client[]> {
    const lower = term.toLowerCase();

    return this.clients
      .filter(client =>
        [client.name, client.email, client.phone].some(field =>
          (field || '').toLowerCase().includes(lower),
        ),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
  }
}

export default FakeClientsRepository;
