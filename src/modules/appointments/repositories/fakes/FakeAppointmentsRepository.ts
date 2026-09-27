import { uuid } from 'uuidv4';
import { getMonth, getYear, getDate, isBefore, isAfter } from 'date-fns';
import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import ICreateAppointmentDTO from '@modules/appointments/dtos/ICreateAppointmentDTO';
import IFindAllInMonthFromProviderDTO from '@modules/appointments/dtos/IFindAllInMonthFromProviderDTO';
import IFindAllInDayFromProviderDTO from '@modules/appointments/dtos/IFindAllInDayFromProviderDTO';
import IFindAllInDayDTO from '@modules/appointments/dtos/IFindAllInDayDTO';
import IFindOverlappingDTO from '@modules/appointments/dtos/IFindOverlappingDTO';

import Appointment from '../../infra/typeorm/entities/Appointment';

function isSameDay(
  date: Date,
  { day, month, year }: { day: number; month: number; year: number },
): boolean {
  return (
    getDate(date) === day &&
    getMonth(date) + 1 === month &&
    getYear(date) === year
  );
}

class AppointmentsRepository implements IAppointmentsRepository {
  private appointments: Appointment[] = [];

  public async findOverlapping({
    provider_id,
    start,
    end,
  }: IFindOverlappingDTO): Promise<Appointment | undefined> {
    return this.appointments.find(
      appointment =>
        appointment.provider_id === provider_id &&
        isBefore(appointment.date, end) &&
        isAfter(appointment.blocked_until, start),
    );
  }

  public async findAllInMonthFromProvider({
    provider_id,
    month,
    year,
  }: IFindAllInMonthFromProviderDTO): Promise<Appointment[]> {
    return this.appointments.filter(
      appointment =>
        appointment.provider_id === provider_id &&
        getMonth(appointment.date) + 1 === month &&
        getYear(appointment.date) === year,
    );
  }

  public async findAllInDayFromProvider({
    provider_id,
    ...day
  }: IFindAllInDayFromProviderDTO): Promise<Appointment[]> {
    return this.appointments.filter(
      appointment =>
        appointment.provider_id === provider_id &&
        isSameDay(appointment.date, day),
    );
  }

  public async findAllInDay(day: IFindAllInDayDTO): Promise<Appointment[]> {
    return this.appointments
      .filter(appointment => isSameDay(appointment.date, day))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async create(data: ICreateAppointmentDTO): Promise<Appointment> {
    const appointment = new Appointment();

    Object.assign(appointment, data, {
      id: uuid(),
      // No banco, preenchido pelo @CreateDateColumn
      created_at: new Date(),
    });

    this.appointments.push(appointment);

    return appointment;
  }
}
export default AppointmentsRepository;
