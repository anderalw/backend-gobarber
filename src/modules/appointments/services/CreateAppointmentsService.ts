import { format, setMilliseconds, setSeconds } from 'date-fns';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';

import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepaository from '../repositories/IAppointmentsRepository';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';
import checkAvailableSlot from '../utils/checkAvailableSlot';

interface IRequest {
  provider_id: string;
  service_id: string;
  date: Date;
  client_id: string;
  // false quando o próprio barbeiro marcou na agenda dele
  notifyProvider?: boolean;
}
@injectable()
class CreateAppointmentsServices {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepaository,

    @inject('NotificationsRepository')
    private notificationsRepository: INotificationsRepository,

    @inject('CacheProvider')
    private cacheProvider: ICacheProvider,

    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,

    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,

    @inject(AgendaSettingsService)
    private agendaSettings: AgendaSettingsService,

    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('TimeBlocksRepository')
    private timeBlocksRepository: ITimeBlocksRepository,
  ) {}

  public async execute({
    date,
    provider_id,
    client_id,
    service_id,
    notifyProvider = true,
  }: IRequest): Promise<Appointment> {
    const appointmentDate = setMilliseconds(setSeconds(date, 0), 0);

    if (client_id === provider_id) {
      throw new AppError('Não é possível agendar consigo mesmo.');
    }

    const service = await this.servicesRepository.findById(service_id);

    if (!service || !service.active) {
      throw new AppError('Serviço não encontrado.');
    }

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
        start: appointmentDate,
        durationMinutes: service.duration_minutes,
      },
    );

    const appointment = await this.appointmentsRepository.create({
      provider_id,
      client_id,
      service_id: service.id,
      // Guarda o valor do momento: mudar o preço depois não altera o histórico
      price_cents: service.price_cents,
      date: appointmentDate,
      end_date: end,
      blocked_until: blockedUntil,
    });
    const dateFormatted = format(appointmentDate, "dd/MM/yyyy 'às' HH:mm'h'");

    if (notifyProvider) {
      await this.notificationsRepository.create({
        recipient_id: provider_id,
        content: `Novo agendamento de ${service.name} para dia ${dateFormatted}`,
        date: appointmentDate,
      });
    }

    await this.cacheProvider.invalidate(
      `provider-appointments:${provider_id}:${format(
        appointmentDate,
        'yyyy-M-d',
      )}`,
    );

    return appointment;
  }
}
export default CreateAppointmentsServices;
