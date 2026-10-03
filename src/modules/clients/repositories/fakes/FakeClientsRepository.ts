import { randomUUID } from 'crypto';
import IListClientsDTO from '@modules/clients/dtos/IListClientsDTO';

import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import ICreateClientDTO from '@modules/clients/dtos/ICreateClientDTO';
import Client from '../../infra/typeorm/entities/Client';

class FakeClientsRepository implements IClientsRepository {
  private clients: Client[] = [];

  public async create(data: ICreateClientDTO): Promise<Client> {
    const client = new Client();

    Object.assign(client, { id: randomUUID(), google_id: null }, data);

    this.clients.push(client);

    return client;
  }

  public async save(client: Client): Promise<Client> {
    const index = this.clients.findIndex(item => item.id === client.id);

    this.clients[index] = client;

    return client;
  }

  public async findByCpf(cpf: string): Promise<Client | undefined> {
    return this.clients.find(client => !!cpf && client.cpf === cpf);
  }

  public async findByEmail(email: string): Promise<Client | undefined> {
    return this.clients.find(client => client.email === email);
  }

  public async findById(id: string): Promise<Client | undefined> {
    return this.clients.find(client => client.id === id);
  }

  public async findByGoogleId(google_id: string): Promise<Client | undefined> {
    return this.clients.find(client => client.google_id === google_id);
  }

  public async findByIds(ids: string[]): Promise<Client[]> {
    return this.clients.filter(client => ids.includes(client.id));
  }

  // Sem os agendamentos, o fake só recorta pelo que está no cliente
  // (aniversariantes e novos) e ordena por nome
  public async list({
    search,
    filter,
    month,
    now,
    offset,
    limit,
  }: IListClientsDTO): Promise<{ clients: Client[]; total: number }> {
    let all = search
      ? await this.search(search, Number.MAX_SAFE_INTEGER)
      : [...this.clients].sort((a, b) => a.name.localeCompare(b.name));

    if (filter === 'birthdays') {
      all = all.filter(
        client =>
          !!client.birth_date &&
          Number(client.birth_date.slice(5, 7)) === month,
      );
    }

    if (filter === 'new') {
      const since = now.getTime() - 30 * 24 * 60 * 60 * 1000;

      all = all.filter(
        client => client.created_at && client.created_at.getTime() >= since,
      );
    }

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
