import { injectable, inject } from 'tsyringe';

import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import { clientCanChange } from '../utils/ensureCanChangeAppointment';

interface IClientAppointment {
  id: string;
  date: Date;
  end_date: Date;
  provider: { id: string; name: string; avatar_url: string | null };
  service: { id: string; name: string } | null;
  price_cents: number | null;
  // Ainda dá tempo de o cliente cancelar ou remarcar sozinho
  can_change: boolean;
}

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
      can_change: clientCanChange(appointment, now),
    }));
  }
}

export default ListClientAppointmentsService;
