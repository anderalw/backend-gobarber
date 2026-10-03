import { injectable, inject } from 'tsyringe';

import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import NoShowPolicyService, {
  hasNoShowAlert,
  RECENT_APPOINTMENTS,
} from '@modules/appointments/services/NoShowPolicyService';
import IClientsRepository from '../repositories/IClientsRepository';
import IClientProfile, { toClientProfile } from '../dtos/IClientProfile';
import emptySummary from '../utils/emptySummary';
import {
  ClientFilter,
  ClientSort,
  SortDirection,
} from '../dtos/IListClientsDTO';

interface IRequest {
  search?: string;
  page?: number;
  filter?: ClientFilter;
  sort?: ClientSort;
  direction?: SortDirection;
  inactive_days?: number;
  // Aniversariantes: mês de 1 a 12 (padrão: o atual)
  month?: number;
}

// Exportar: no máximo isso de uma vez
export const EXPORT_LIMIT = 5000;

interface IResponse {
  clients: IClientProfile[];
  total: number;
  page: number;
  per_page: number;
}

export const PER_PAGE = 20;

// Lista de clientes da barbearia, com o resumo de cada um (visitas, faltas,
// quanto já gastou)
@injectable()
class ListClientsService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject(NoShowPolicyService)
    private noShowPolicy: NoShowPolicyService,
  ) {}

  public async execute({ page = 1, ...options }: IRequest): Promise<IResponse> {
    const current = Math.max(1, Math.floor(page));
    const { clients, total } = await this.load(
      options,
      (current - 1) * PER_PAGE,
      PER_PAGE,
    );

    return {
      clients,
      total,
      page: current,
      per_page: PER_PAGE,
    };
  }

  // Todos do recorte (para a planilha)
  public async all(options: Omit<IRequest, 'page'>): Promise<IClientProfile[]> {
    return (await this.load(options, 0, EXPORT_LIMIT)).clients;
  }

  private async load(
    {
      search = '',
      filter = 'all',
      sort,
      direction,
      inactive_days = 60,
      month,
    }: Omit<IRequest, 'page'>,
    offset: number,
    limit: number,
  ): Promise<{ clients: IClientProfile[]; total: number }> {
    const now = new Date(Date.now());
    // Aniversariantes vêm na ordem do dia; o resto, por nome
    const defaultSort: ClientSort =
      filter === 'birthdays' ? 'birthday' : 'name';
    const { clients, total } = await this.clientsRepository.list({
      search: search.trim(),
      filter,
      sort: sort || defaultSort,
      direction: direction || 'asc',
      inactive_days,
      month: month || now.getMonth() + 1,
      now,
      offset,
      limit,
    });

    const [summaries, policy] = await Promise.all([
      this.appointmentsRepository.summarizeByClients(
        clients.map(client => client.id),
        now,
        RECENT_APPOINTMENTS,
      ),
      this.noShowPolicy.get(),
    ]);

    return {
      clients: clients.map(client => {
        const summary =
          summaries.find(item => item.client_id === client.id) ||
          emptySummary(client.id);

        return toClientProfile(
          client,
          summary,
          hasNoShowAlert(summary.recent_no_shows, policy),
        );
      }),
      total,
    };
  }
}

export default ListClientsService;
