import { injectable, inject } from 'tsyringe';
import { format, parseISO } from 'date-fns';

import AppError from '@shared/errors/AppError';
import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import WaitlistEntry, {
  WaitlistPeriod,
} from '../infra/typeorm/entities/WaitlistEntry';
import IWaitlistRepository from '../repositories/IWaitlistRepository';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';

interface IAddRequest {
  client_id: string;
  // 'yyyy-MM-dd'
  date: string;
  provider_id?: string | null;
  service_id?: string | null;
  period?: WaitlistPeriod;
  notes?: string | null;
  created_by: 'provider' | 'client';
  // Barbeiro que colocou na lista (null quando é o cliente)
  created_by_user?: string | null;
}

export interface IWaitlistItem {
  id: string;
  date: string;
  period: WaitlistPeriod;
  notes: string | null;
  created_by: 'provider' | 'client';
  created_at: Date;
  notified_at: Date | null;
  client: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  } | null;
  provider: { id: string; name: string } | null;
  service: { id: string; name: string } | null;
  // O cliente já conseguiu marcar neste dia
  booked: boolean;
}

const today = (): string => format(Date.now(), 'yyyy-MM-dd');

// Lista de espera: clientes que queriam um horário num dia lotado
@injectable()
class WaitlistService {
  constructor(
    @inject('WaitlistRepository')
    private waitlistRepository: IWaitlistRepository,

    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,

    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,
  ) {}

  public async add({
    client_id,
    date,
    provider_id = null,
    service_id = null,
    period = 'any',
    notes = null,
    created_by,
    created_by_user = null,
  }: IAddRequest): Promise<WaitlistEntry> {
    if (date < today()) {
      throw new AppError('Escolha um dia a partir de hoje.');
    }

    if (!(await this.clientsRepository.findById(client_id))) {
      throw new AppError('Cliente não encontrado.');
    }

    if (provider_id && !(await this.usersRepository.findById(provider_id))) {
      throw new AppError('Profissional não encontrado.');
    }

    if (service_id) {
      const service = await this.servicesRepository.findById(service_id);

      if (!service || !service.active) {
        throw new AppError('Serviço não encontrado.');
      }
    }

    // Dia sem expediente (do barbeiro escolhido ou de todos): não há vaga
    // para esperar
    const working = (
      await this.providerSchedulesRepository.findByDayOfWeek(
        parseISO(date).getDay(),
      )
    ).filter(schedule => !provider_id || schedule.provider_id === provider_id);

    if (working.length === 0) {
      throw new AppError(
        provider_id
          ? 'Este profissional não atende neste dia.'
          : 'Não há atendimento neste dia.',
      );
    }

    if (await this.bookedClients(date).then(ids => ids.has(client_id))) {
      throw new AppError(
        created_by === 'client'
          ? 'Você já tem um horário marcado neste dia.'
          : 'Este cliente já tem um horário marcado neste dia.',
      );
    }

    const cleanNotes = notes && notes.trim() ? notes.trim() : null;

    // Já está esperando neste dia: atualiza a preferência
    const existing = await this.waitlistRepository.findWaitingByClientAndDate(
      client_id,
      date,
    );

    if (existing) {
      existing.provider_id = provider_id;
      existing.service_id = service_id;
      existing.period = period;
      existing.notes = cleanNotes ?? existing.notes;

      return this.waitlistRepository.save(existing);
    }

    return this.waitlistRepository.create({
      client_id,
      date,
      provider_id,
      service_id,
      period,
      notes: cleanNotes,
      created_by,
      created_by_user,
    });
  }

  // Quem está esperando no dia, na ordem de chegada
  public async listByDate(date: string): Promise<IWaitlistItem[]> {
    const [entries, booked] = await Promise.all([
      this.waitlistRepository.findWaitingByDate(date),
      this.bookedClients(date),
    ]);

    return entries.map(entry => ({
      id: entry.id,
      date: entry.date,
      period: entry.period,
      notes: entry.notes,
      created_by: entry.created_by,
      created_at: entry.created_at,
      notified_at: entry.notified_at,
      client: entry.client
        ? {
            id: entry.client.id,
            name: entry.client.name,
            phone: entry.client.phone,
            email: entry.client.email,
          }
        : null,
      provider: entry.provider
        ? { id: entry.provider.id, name: entry.provider.name }
        : null,
      service: entry.service
        ? { id: entry.service.id, name: entry.service.name }
        : null,
      booked: booked.has(entry.client_id),
    }));
  }

  // Dias em que o cliente está esperando, a partir de hoje
  public async listForClient(client_id: string): Promise<WaitlistEntry[]> {
    return this.waitlistRepository.findWaitingByClient(client_id, today());
  }

  // O cliente só tira a si mesmo; a barbearia tira qualquer um
  public async remove(
    id: string,
    requester: { id: string; role: 'provider' | 'client' },
  ): Promise<void> {
    const entry = await this.waitlistRepository.findById(id);

    if (
      !entry ||
      entry.status !== 'waiting' ||
      (requester.role === 'client' && entry.client_id !== requester.id)
    ) {
      throw new AppError('Pedido da lista de espera não encontrado.', 404);
    }

    entry.status = 'removed';

    await this.waitlistRepository.save(entry);
  }

  // Clientes com horário marcado no dia
  private async bookedClients(date: string): Promise<Set<string>> {
    const day = parseISO(date);
    const appointments = await this.appointmentsRepository.findAllInDay({
      day: day.getDate(),
      month: day.getMonth() + 1,
      year: day.getFullYear(),
    });

    return new Set(
      appointments.flatMap(appointment =>
        appointment.client_id ? [appointment.client_id] : [],
      ),
    );
  }
}

export default WaitlistService;
