import {
  differenceInMinutes,
  format,
  isEqual,
  setMilliseconds,
  setSeconds,
} from 'date-fns';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';
import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import MembershipBenefitService from '@modules/memberships/services/MembershipBenefitService';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';
import IClientNotifier from '../notifier/IClientNotifier';
import NotifyWaitlistService from './NotifyWaitlistService';
import checkAvailableSlot from '../utils/checkAvailableSlot';
import ensureCanChangeAppointment, {
  IRequester,
} from '../utils/ensureCanChangeAppointment';

interface IRequest {
  appointment_id: string;
  requester: IRequester;
  // Pode ser o mesmo barbeiro ou outro
  provider_id: string;
  date: Date;
}

const formatDate = (date: Date): string =>
  format(date, "dd/MM/yyyy 'às' HH:mm");

// Muda data, horário e/ou barbeiro. Serviço, valor e duração continuam os
// da marcação original
@injectable()
class RescheduleAppointmentService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,

    @inject(AgendaSettingsService)
    private agendaSettings: AgendaSettingsService,

    @inject('NotificationsRepository')
    private notificationsRepository: INotificationsRepository,

    @inject('CacheProvider')
    private cacheProvider: ICacheProvider,

    @inject('TimeBlocksRepository')
    private timeBlocksRepository: ITimeBlocksRepository,
    @inject('ClientNotifier')
    private clientNotifier: IClientNotifier,

    @inject(NotifyWaitlistService)
    private notifyWaitlist: NotifyWaitlistService,

    // Clube: a nova data pode mudar o que o plano cobre (opcional nos
    // testes que não envolvem o clube)
    @inject(MembershipBenefitService)
    private membershipBenefit?: MembershipBenefitService,
  ) {}

  public async execute({
    appointment_id,
    requester,
    provider_id,
    date,
  }: IRequest): Promise<Appointment> {
    const appointment = ensureCanChangeAppointment(
      await this.appointmentsRepository.findById(appointment_id),
      requester,
      new Date(Date.now()),
    );

    const newStart = setMilliseconds(setSeconds(date, 0), 0);
    const oldProviderId = appointment.provider_id;
    const oldProviderName = appointment.provider?.name || '';
    const oldStart = appointment.date;

    if (provider_id === oldProviderId && isEqual(newStart, oldStart)) {
      throw new AppError('Escolha um horário diferente do atual.');
    }

    const provider = await this.usersRepository.findById(provider_id);

    if (!provider) {
      throw new AppError('Profissional não encontrado.');
    }

    // Mantém a duração da marcação, mesmo que o serviço tenha mudado depois
    const durationMinutes = differenceInMinutes(
      appointment.end_date,
      appointment.date,
    );

    const { end, blockedUntil } = await checkAvailableSlot(
      {
        usersRepository: this.usersRepository,
        appointmentsRepository: this.appointmentsRepository,
        providerSchedulesRepository: this.providerSchedulesRepository,
        agendaSettings: this.agendaSettings,
        timeBlocksRepository: this.timeBlocksRepository,
      },
      {
        provider_id,
        start: newStart,
        durationMinutes,
        except_appointment_id: appointment.id,
      },
    );

    // Como estava antes: o horário antigo fica livre
    const previous = Object.assign(new Appointment(), appointment);

    appointment.provider_id = provider_id;
    appointment.date = newStart;
    appointment.end_date = end;
    appointment.blocked_until = blockedUntil;
    // O novo horário precisa ser confirmado de novo
    appointment.confirmation_token = null;
    appointment.confirmation_requested_at = null;
    appointment.confirmed_at = null;
    appointment.confirmed_by = null;

    if (
      this.membershipBenefit &&
      appointment.client_id &&
      appointment.service_id
    ) {
      const benefit = await this.membershipBenefit.evaluate({
        client_id: appointment.client_id,
        service_id: appointment.service_id,
        // O preço da marcação original, sem o benefício anterior
        price_cents:
          appointment.list_price_cents ?? appointment.price_cents ?? 0,
        date: newStart,
        except_appointment_id: appointment.id,
      });

      appointment.price_cents = benefit.price_cents;
      appointment.membership_id = benefit.membership_id;
      appointment.list_price_cents = benefit.list_price_cents;
    }

    const rescheduled = await this.appointmentsRepository.save(appointment);

    const serviceName = appointment.service?.name || 'serviço';

    await this.notificationsRepository.create({
      recipient_id: provider_id,
      content:
        provider_id === oldProviderId
          ? `Agendamento de ${serviceName} remarcado de ${formatDate(
              oldStart,
            )} para ${formatDate(newStart)}`
          : `Novo agendamento de ${serviceName} para dia ${formatDate(
              newStart,
            )} (transferido de outro barbeiro)`,
      date: newStart,
    });

    if (provider_id !== oldProviderId) {
      await this.notificationsRepository.create({
        recipient_id: oldProviderId,
        content: `Agendamento de ${serviceName} em ${formatDate(
          oldStart,
        )} transferido para ${provider.name}`,
        date: oldStart,
      });
    }

    await Promise.all(
      [
        [oldProviderId, oldStart],
        [provider_id, newStart],
      ].map(([id, day]) =>
        this.cacheProvider.invalidate(
          `provider-appointments:${id}:${format(day as Date, 'yyyy-M-d')}`,
        ),
      ),
    );

    await this.clientNotifier.appointmentRescheduled(rescheduled, {
      date: oldStart,
      providerName: oldProviderName,
    });

    await this.notifyWaitlist.slotFreed(previous);

    return rescheduled;
  }
}

export default RescheduleAppointmentService;
