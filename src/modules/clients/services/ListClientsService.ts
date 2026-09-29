import { injectable, inject } from 'tsyringe';

import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import NoShowPolicyService, {
  hasNoShowAlert,
  RECENT_APPOINTMENTS,
} from '@modules/appointments/services/NoShowPolicyService';
import IClientsRepository from '../repositories/IClientsRepository';
import IClientProfile, { toClientProfile } from '../dtos/IClientProfile';
import emptySummary from '../utils/emptySummary';

interface IRequest {
  search?: string;
  page?: number;
}

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

  public async execute({
    search = '',
    page = 1,
  }: IRequest): Promise<IResponse> {
    const current = Math.max(1, Math.floor(page));
    const { clients, total } = await this.clientsRepository.list({
      search: search.trim(),
      offset: (current - 1) * PER_PAGE,
      limit: PER_PAGE,
    });

    const now = new Date(Date.now());
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
      page: current,
      per_page: PER_PAGE,
    };
  }
}

export default ListClientsService;
