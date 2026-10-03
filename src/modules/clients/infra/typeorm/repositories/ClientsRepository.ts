import { ILike, In, Repository } from 'typeorm';
import dataSource from '@shared/infra/typeorm/dataSource';
import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import ICreateClientDTO from '@modules/clients/dtos/ICreateClientDTO';
import IListClientsDTO, {
  ClientSort,
} from '@modules/clients/dtos/IListClientsDTO';
import Client from '../entities/Client';

// Colunas de ordenação (lista fechada: entra direto no SQL)
const SORT_COLUMNS: Record<ClientSort, string> = {
  name: 'c.name',
  visits: 'COALESCE(s.visits, 0)',
  no_shows: 'COALESCE(s.no_shows, 0)',
  last_visit: 's.last_visit',
  next_appointment: 's.next_appointment',
  total: 'COALESCE(s.total_cents, 0)',
  birthday:
    'EXTRACT(MONTH FROM c.birth_date) * 100 + EXTRACT(DAY FROM c.birth_date)',
};

const DAY_MS = 24 * 60 * 60 * 1000;

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

  // Resumo dos agendamentos de cada cliente junto, para recortar e ordenar
  // por ele (o banco já separa por barbearia)
  public async list({
    search,
    filter,
    sort,
    direction,
    inactive_days,
    month,
    now,
    offset,
    limit,
  }: IListClientsDTO): Promise<{ clients: Client[]; total: number }> {
    const params: unknown[] = [now];
    const param = (value: unknown): string => {
      params.push(value);

      return `$${params.length}`;
    };
    const conditions: string[] = [];

    if (search) {
      const pattern = param(
        `%${search.replace(/[\\%_]/g, char => `\\${char}`)}%`,
      );
      const digits = search.replace(/\D/g, '');
      const options = [
        `c.name ILIKE ${pattern}`,
        `c.email ILIKE ${pattern}`,
        `c.phone ILIKE ${pattern}`,
      ];

      // Telefone e CPF ficam só com os números
      if (digits.length >= 3) {
        const digitsPattern = param(`%${digits}%`);

        options.push(`c.phone LIKE ${digitsPattern}`);
        options.push(`c.cpf LIKE ${digitsPattern}`);
      }

      conditions.push(`(${options.join(' OR ')})`);
    }

    if (filter === 'inactive') {
      conditions.push(
        `s.last_visit < ${param(
          new Date(now.getTime() - inactive_days * DAY_MS),
        )} AND s.next_appointment IS NULL`,
      );
    }

    if (filter === 'birthdays') {
      conditions.push(`EXTRACT(MONTH FROM c.birth_date) = ${param(month)}`);
    }

    if (filter === 'no_shows') {
      conditions.push('s.no_shows > 0');
    }

    if (filter === 'club') {
      conditions.push(
        "EXISTS (SELECT 1 FROM memberships m WHERE m.client_id = c.id AND m.status = 'active')",
      );
    }

    if (filter === 'new') {
      conditions.push(
        `c.created_at >= ${param(new Date(now.getTime() - 30 * DAY_MS))}`,
      );
    }

    const from = `FROM clients c
      LEFT JOIN (
        SELECT client_id,
          COUNT(*) FILTER (WHERE attendance = 'completed') AS visits,
          COUNT(*) FILTER (WHERE attendance = 'no_show') AS no_shows,
          COALESCE(SUM(COALESCE(paid_cents, price_cents)) FILTER (WHERE attendance = 'completed'), 0) AS total_cents,
          MAX(date) FILTER (WHERE attendance = 'completed') AS last_visit,
          MIN(date) FILTER (WHERE canceled_at IS NULL AND date > $1) AS next_appointment
        FROM appointments
        WHERE client_id IS NOT NULL
        GROUP BY client_id
      ) s ON s.client_id = c.id
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}`;

    const order = `${SORT_COLUMNS[sort]} ${
      direction === 'desc' ? 'DESC' : 'ASC'
    } NULLS LAST, c.name ASC, c.id ASC`;

    const [{ total }] = await this.ormRepository.query(
      `SELECT COUNT(*) AS total ${from}`,
      params,
    );
    const rows: Array<{ id: string }> = await this.ormRepository.query(
      `SELECT c.id ${from} ORDER BY ${order} LIMIT ${param(
        limit,
      )} OFFSET ${param(offset)}`,
      params,
    );

    const clients = await this.findByIds(rows.map(row => row.id));
    const byId = new Map(clients.map(client => [client.id, client]));

    return {
      clients: rows
        .map(row => byId.get(row.id))
        .filter((client): client is Client => !!client),
      total: Number(total),
    };
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
