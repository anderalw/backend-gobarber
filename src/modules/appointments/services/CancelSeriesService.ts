import { injectable, inject } from 'tsyringe';
import { format } from 'date-fns';

import AppError from '@shared/errors/AppError';
import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';
import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import IClientNotifier from '../notifier/IClientNotifier';
import NotifyWaitlistService from './NotifyWaitlistService';
import ensureCanChangeAppointment from '../utils/ensureCanChangeAppointment';

interface IRequest {
  appointment_id: string;
  // Barbeiro logado (só a barbearia cancela a série)
  requester_id: string;
}

// Cancela um agendamento de cliente fixo e os seguintes da mesma série. Os
// anteriores (e os já atendidos) ficam como estão
@injectable()
class CancelSeriesService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('NotificationsRepository')
    private notificationsRepository: INotificationsRepository,

    @inject('CacheProvider')
    private cacheProvider: ICacheProvider,

    @inject('ClientNotifier')
    private clientNotifier: IClientNotifier,

    @inject(NotifyWaitlistService)
    private notifyWaitlist: NotifyWaitlistService,
  ) {}

  public async execute({
    appointment_id,
    requester_id,
  }: IRequest): Promise<Appointment[]> {
    const now = new Date(Date.now());
    const requester = { id: requester_id, role: 'provider' as const };

    const appointment = ensureCanChangeAppointment(
      await this.appointmentsRepository.findById(appointment_id),
      requester,
      now,
    );

    if (!appointment.series_id) {
      throw new AppError('Este agendamento não faz parte de um cliente fixo.');
    }

    const following = await this.appointmentsRepository.findFollowingInSeries(
      appointment.series_id,
      appointment.date,
    );

    const canceled: Appointment[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const item of following) {
      item.canceled_at = now;
      item.canceled_by = 'provider';

      // eslint-disable-next-line no-await-in-loop
      canceled.push(await this.appointmentsRepository.save(item));

      // eslint-disable-next-line no-await-in-loop
      await this.cacheProvider.invalidate(
        `provider-appointments:${item.provider_id}:${format(
          item.date,
          'yyyy-M-d',
        )}`,
      );
    }

    if (canceled.length === 0) return canceled;

    const serviceName = appointment.service?.name || 'serviço';

    // Um aviso por barbeiro envolvido (quem cancelou já sabe)
    const providers = Array.from(
      new Set(canceled.map(item => item.provider_id)),
    );

    await Promise.all(
      providers
        .filter(provider_id => provider_id !== requester_id)
        .map(provider_id =>
          this.notificationsRepository.create({
            recipient_id: provider_id,
            content: `Cliente fixo cancelado pela equipe: ${
              canceled.length
            } agendamentos de ${serviceName} a partir de ${format(
              appointment.date,
              "dd/MM/yyyy 'às' HH:mm",
            )}`,
            date: appointment.date,
          }),
        ),
    );

    await this.clientNotifier.seriesCanceled(canceled);

    // Cada horário liberado pode servir para alguém da lista de espera
    // eslint-disable-next-line no-restricted-syntax
    for (const item of canceled) {
      // eslint-disable-next-line no-await-in-loop
      await this.notifyWaitlist.slotFreed(item);
    }

    return canceled;
  }
}

export default CancelSeriesService;
