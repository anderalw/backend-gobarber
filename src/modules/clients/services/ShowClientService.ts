import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import { Attendance } from '@modules/appointments/infra/typeorm/entities/Appointment';
import NoShowPolicyService, {
  hasNoShowAlert,
  RECENT_APPOINTMENTS,
} from '@modules/appointments/services/NoShowPolicyService';
import IClientsRepository from '../repositories/IClientsRepository';
import IClientProfile, { toClientProfile } from '../dtos/IClientProfile';
import emptySummary from '../utils/emptySummary';

interface IHistoryItem {
  id: string;
  date: Date;
  end_date: Date;
  provider: { id: string; name: string } | null;
  service: { id: string; name: string } | null;
  price_cents: number | null;
  // Clube: coberto pelo plano (preço 0)
  included: boolean;
  attendance: Attendance | null;
  canceled_at: Date | null;
  canceled_by: 'provider' | 'client' | null;
  confirmed_at: Date | null;
}

interface IResponse extends IClientProfile {
  // Todos os agendamentos, do mais recente ao mais antigo
  appointments: IHistoryItem[];
}

// Ficha do cliente: contatos, observações, resumo e histórico completo
@injectable()
class ShowClientService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject(NoShowPolicyService)
    private noShowPolicy: NoShowPolicyService,
  ) {}

  public async execute(client_id: string): Promise<IResponse> {
    const client = await this.clientsRepository.findById(client_id);

    if (!client) {
      throw new AppError('Cliente não encontrado.', 404);
    }

    const now = new Date(Date.now());
    const [[summary], appointments, policy] = await Promise.all([
      this.appointmentsRepository.summarizeByClients(
        [client.id],
        now,
        RECENT_APPOINTMENTS,
      ),
      this.appointmentsRepository.findAllFromClient(client.id),
      this.noShowPolicy.get(),
    ]);

    const full = summary || emptySummary(client.id);

    return {
      ...toClientProfile(
        client,
        full,
        hasNoShowAlert(full.recent_no_shows, policy),
      ),
      appointments: appointments.map(appointment => ({
        id: appointment.id,
        date: appointment.date,
        end_date: appointment.end_date,
        provider: appointment.provider
          ? { id: appointment.provider.id, name: appointment.provider.name }
          : null,
        service: appointment.service
          ? { id: appointment.service.id, name: appointment.service.name }
          : null,
        price_cents: appointment.price_cents,
        included: !!appointment.membership_id,
        attendance: appointment.attendance,
        canceled_at: appointment.canceled_at,
        canceled_by: appointment.canceled_by,
        confirmed_at: appointment.confirmed_at,
      })),
    };
  }
}

export default ShowClientService;
