import { injectable, inject } from 'tsyringe';

import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import { clientCanChange } from '../utils/ensureCanChangeAppointment';
import { isIncluded } from '../utils/payment';

interface IClientAppointment {
  id: string;
  date: Date;
  end_date: Date;
  provider: { id: string; name: string; avatar_url: string | null };
  service: { id: string; name: string } | null;
  price_cents: number | null;
  // Clube: incluso no plano / preço normal quando houve benefício
  included: boolean;
  list_price_cents: number | null;
  // Incluso num pacote de sessões
  package: boolean;
  // Sinal pedido e quando foi recebido (null = ainda não)
  deposit_cents: number | null;
  deposit_paid_at: Date | null;
  // Ainda dá tempo de o cliente cancelar ou remarcar sozinho
  can_change: boolean;
}

// Horário que já passou, para o histórico do cliente
interface IClientPastAppointment {
  id: string;
  date: Date;
  provider: { id: string; name: string; avatar_url: string | null };
  service: { id: string; name: string } | null;
  price_cents: number | null;
  included: boolean;
  // null = a barbearia ainda não registrou
  attendance: 'completed' | 'no_show' | null;
}

// Quantos horários anteriores o cliente vê
const HISTORY_LIMIT = 20;

// Próximos agendamentos do cliente ("Meus agendamentos")
@injectable()
class ListClientAppointmentsService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,
  ) {}

  public async execute(client_id: string): Promise<IClientAppointment[]> {
    const now = new Date(Date.now());

    const appointments =
      await this.appointmentsRepository.findUpcomingFromClient(client_id, now);

    return appointments.map(appointment => ({
      id: appointment.id,
      date: appointment.date,
      end_date: appointment.end_date,
      provider: {
        id: appointment.provider_id,
        name: appointment.provider?.name,
        avatar_url: appointment.provider?.getAvatarUrl() || null,
      },
      service: appointment.service
        ? { id: appointment.service.id, name: appointment.service.name }
        : null,
      price_cents: appointment.price_cents,
      included: isIncluded(appointment),
      list_price_cents: appointment.list_price_cents,
      package: !!appointment.package_id,
      deposit_cents: appointment.deposit_cents,
      deposit_paid_at: appointment.deposit_paid_at,
      can_change: clientCanChange(appointment, now),
    }));
  }

  // Últimos horários que já passaram (sem os cancelados), do mais recente
  public async history(client_id: string): Promise<IClientPastAppointment[]> {
    const now = new Date(Date.now());

    const appointments = (
      await this.appointmentsRepository.findAllFromClient(client_id)
    )
      .filter(item => !item.canceled_at && item.end_date <= now)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, HISTORY_LIMIT);

    return appointments.map(appointment => ({
      id: appointment.id,
      date: appointment.date,
      provider: {
        id: appointment.provider_id,
        name: appointment.provider?.name,
        avatar_url: appointment.provider?.getAvatarUrl() || null,
      },
      service: appointment.service
        ? { id: appointment.service.id, name: appointment.service.name }
        : null,
      price_cents: appointment.price_cents,
      included: isIncluded(appointment),
      attendance: appointment.attendance,
    }));
  }
}

export default ListClientAppointmentsService;
