import {
  addMinutes,
  format,
  getDay,
  isAfter,
  isBefore,
  setMilliseconds,
  setSeconds,
} from 'date-fns';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';

import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepaository from '../repositories/IAppointmentsRepository';
import workWindow from '../utils/workWindow';

interface IRequest {
  provider_id: string;
  client_id: string;
  service_id: string;
  date: Date;
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
  ) {}

  public async execute({
    date,
    provider_id,
    client_id,
    service_id,
  }: IRequest): Promise<Appointment> {
    const appointmentDate = setMilliseconds(setSeconds(date, 0), 0);

    if (isBefore(appointmentDate, Date.now())) {
      throw new AppError('Não é possível agendar numa data passada.');
    }

    if (client_id === provider_id) {
      throw new AppError('Não é possível agendar consigo mesmo.');
    }

    const service = await this.servicesRepository.findById(service_id);

    if (!service || !service.active) {
      throw new AppError('Serviço não encontrado.');
    }

    const schedules = await this.providerSchedulesRepository.findByProviderId(
      provider_id,
    );

    const scheduleForDay = schedules.find(
      schedule => schedule.day_of_week === getDay(appointmentDate),
    );

    if (!scheduleForDay) {
      throw new AppError('O barbeiro não atende neste dia.');
    }

    const endDate = addMinutes(appointmentDate, service.duration_minutes);
    const { workStart, workEnd } = workWindow(appointmentDate, scheduleForDay);

    // O atendimento inteiro precisa caber no expediente
    if (isBefore(appointmentDate, workStart) || isAfter(endDate, workEnd)) {
      throw new AppError(
        `Este barbeiro só atende entre ${scheduleForDay.start_time} e ${scheduleForDay.end_time}.`,
      );
    }

    const { buffer_minutes } = await this.agendaSettings.get();
    const blockedUntil = addMinutes(endDate, buffer_minutes);

    const overlapping = await this.appointmentsRepository.findOverlapping({
      provider_id,
      start: appointmentDate,
      end: blockedUntil,
    });

    if (overlapping) {
      throw new AppError('Este horário já está reservado.');
    }

    const appointment = await this.appointmentsRepository.create({
      provider_id,
      client_id,
      service_id: service.id,
      // Guarda o valor do momento: mudar o preço depois não altera o histórico
      price_cents: service.price_cents,
      date: appointmentDate,
      end_date: endDate,
      blocked_until: blockedUntil,
    });
    const dateFormatted = format(appointmentDate, "dd/MM/yyyy 'às' HH:mm'h'");

    await this.notificationsRepository.create({
      recipient_id: provider_id,
      content: `Novo agendamento de ${service.name} para dia ${dateFormatted}`,
    });

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
