import { startOfHour, isBefore, getHours, getDay, format } from 'date-fns';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';

import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepaository from '../repositories/IAppointmentsRepository';

interface IRequest {
  provider_id: string;
  client_id: string;
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
  ) {}

  public async execute({
    date,
    provider_id,
    client_id,
  }: IRequest): Promise<Appointment> {
    const appointmentDate = startOfHour(date);

    if (isBefore(appointmentDate, Date.now())) {
      throw new AppError("You can't create an appointment on a past date");
    }

    if (client_id === provider_id) {
      throw new AppError("You can't create an appointmet with yourself");
    }

    const schedules = await this.providerSchedulesRepository.findByProviderId(
      provider_id,
    );

    const scheduleForDay = schedules.find(
      schedule => schedule.day_of_week === getDay(appointmentDate),
    );

    if (!scheduleForDay) {
      throw new AppError('This provider does not work on this day');
    }

    // Mesma regra da disponibilidade do dia: de start_time até end_time - 1h
    const startHour = Number(scheduleForDay.start_time.split(':')[0]);
    const endHour = Number(scheduleForDay.end_time.split(':')[0]);
    const appointmentHour = getHours(appointmentDate);

    if (appointmentHour < startHour || appointmentHour >= endHour) {
      throw new AppError(
        `You can only create appointments between ${scheduleForDay.start_time} and ${scheduleForDay.end_time}`,
      );
    }

    const findAppointmentInSameDate = await this.appointmentsRepository.findByDate(
      appointmentDate,
      provider_id,
    );

    if (findAppointmentInSameDate) {
      throw new AppError('This appointment is alredy booked');
    }

    const appointment = await this.appointmentsRepository.create({
      provider_id,
      client_id,
      date: appointmentDate,
    });
    const dateFormatted = format(appointmentDate, "dd/MM/yyyy 'às' HH:mm'h'");

    await this.notificationsRepository.create({
      recipient_id: provider_id,
      content: `Novo agendamento para dia ${dateFormatted}`,
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
