import { injectable, inject } from 'tsyringe';
import { format, isBefore } from 'date-fns';

import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import Appointment from '../infra/typeorm/entities/Appointment';
import { WaitlistPeriod } from '../infra/typeorm/entities/WaitlistEntry';
import IWaitlistRepository from '../repositories/IWaitlistRepository';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import IClientNotifier from '../notifier/IClientNotifier';

// Parte do dia de um horário: manhã até 12h, tarde até 18h, depois noite
export function periodOf(date: Date): Exclude<WaitlistPeriod, 'any'> {
  const hour = date.getHours();

  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';

  return 'evening';
}

// Um horário foi liberado (cancelamento ou remarcação): avisa a barbearia
// se há gente esperando e manda e-mail para quem pode vir nesse horário. Quem
// agendar primeiro fica com ele
@injectable()
class NotifyWaitlistService {
  constructor(
    @inject('WaitlistRepository')
    private waitlistRepository: IWaitlistRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('NotificationsRepository')
    private notificationsRepository: INotificationsRepository,

    @inject('ClientNotifier')
    private clientNotifier: IClientNotifier,
  ) {}

  // freed: o agendamento que saiu do horário (com barbeiro e serviço)
  public async slotFreed(freed: Appointment): Promise<number> {
    if (isBefore(freed.date, Date.now())) return 0;

    const date = format(freed.date, 'yyyy-MM-dd');
    const entries = await this.waitlistRepository.findWaitingByDate(date);

    if (entries.length === 0) return 0;

    // Quem já conseguiu marcar no dia não precisa de aviso
    const booked = new Set(
      (
        await this.appointmentsRepository.findAllInDay({
          day: freed.date.getDate(),
          month: freed.date.getMonth() + 1,
          year: freed.date.getFullYear(),
        })
      ).flatMap(item => (item.client_id ? [item.client_id] : [])),
    );
    const period = periodOf(freed.date);

    const matching = entries.filter(
      entry =>
        entry.client_id !== freed.client_id &&
        !booked.has(entry.client_id) &&
        (!entry.provider_id || entry.provider_id === freed.provider_id) &&
        (entry.period === 'any' || entry.period === period),
    );

    if (matching.length === 0) return 0;

    await this.notificationsRepository.create({
      recipient_id: freed.provider_id,
      content: `Horário liberado em ${format(
        freed.date,
        "dd/MM/yyyy 'às' HH:mm",
      )}: ${matching.length} ${
        matching.length === 1 ? 'cliente' : 'clientes'
      } na lista de espera`,
      date: freed.date,
    });

    const now = new Date(Date.now());

    await Promise.all(
      matching.map(async entry => {
        if (!entry.client?.email) return;

        await this.clientNotifier.waitlistSlotFreed(entry.client, freed);

        await this.waitlistRepository.save(
          Object.assign(entry, { notified_at: now }),
        );
      }),
    );

    return matching.length;
  }
}

export default NotifyWaitlistService;
