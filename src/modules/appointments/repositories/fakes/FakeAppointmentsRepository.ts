import { randomUUID } from 'crypto';
import { getMonth, getYear, getDate, isBefore, isAfter } from 'date-fns';
import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import ICreateAppointmentDTO from '@modules/appointments/dtos/ICreateAppointmentDTO';
import IFindAllInMonthFromProviderDTO from '@modules/appointments/dtos/IFindAllInMonthFromProviderDTO';
import IFindAllInDayFromProviderDTO from '@modules/appointments/dtos/IFindAllInDayFromProviderDTO';
import IFindAllInDayDTO from '@modules/appointments/dtos/IFindAllInDayDTO';
import IFindOverlappingDTO from '@modules/appointments/dtos/IFindOverlappingDTO';
import ISetAttendanceDTO from '@modules/appointments/dtos/ISetAttendanceDTO';

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

  // Cancelados não ocupam horário nem aparecem na agenda
  private get active(): Appointment[] {
    return this.appointments.filter(appointment => !appointment.canceled_at);
  }

  public async findById(id: string): Promise<Appointment | undefined> {
    return this.appointments.find(appointment => appointment.id === id);
  }

  public async findOverlapping({
    provider_id,
    start,
    end,
    except_appointment_id,
  }: IFindOverlappingDTO): Promise<Appointment | undefined> {
    return this.active.find(
      appointment =>
        appointment.id !== except_appointment_id &&
        appointment.provider_id === provider_id &&
        isBefore(appointment.date, end) &&
        isAfter(appointment.blocked_until, start),
    );
  }

  public async findInRangeFromProvider({
    provider_id,
    start,
    end,
  }: IFindOverlappingDTO): Promise<Appointment[]> {
    return this.active.filter(
      appointment =>
        appointment.provider_id === provider_id &&
        isBefore(appointment.date, end) &&
        isAfter(appointment.end_date, start),
    );
  }

  public async findAllInMonthFromProvider({
    provider_id,
    month,
    year,
  }: IFindAllInMonthFromProviderDTO): Promise<Appointment[]> {
    return this.active.filter(
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
    return this.active.filter(
      appointment =>
        appointment.provider_id === provider_id &&
        isSameDay(appointment.date, day),
    );
  }

  public async findAllInDay(day: IFindAllInDayDTO): Promise<Appointment[]> {
    return this.active
      .filter(appointment => isSameDay(appointment.date, day))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async findUpcomingFromProvider(
    provider_id: string,
    now: Date,
  ): Promise<Appointment[]> {
    return this.active
      .filter(
        appointment =>
          appointment.provider_id === provider_id &&
          isAfter(appointment.end_date, now),
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async setAttendance({
    appointment_id,
    ...data
  }: ISetAttendanceDTO): Promise<void> {
    const appointment = this.appointments.find(
      item => item.id === appointment_id,
    );

    if (appointment) Object.assign(appointment, data);
  }

  public async findAllInPeriod(start: Date, end: Date): Promise<Appointment[]> {
    return this.appointments
      .filter(
        appointment =>
          !isBefore(appointment.date, start) && !isAfter(appointment.date, end),
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async countUpcomingFromProvider(
    provider_id: string,
    now: Date,
  ): Promise<number> {
    return this.active.filter(
      appointment =>
        appointment.provider_id === provider_id &&
        isAfter(appointment.end_date, now),
    ).length;
  }

  public async findUpcomingFromClient(
    client_id: string,
    now: Date,
  ): Promise<Appointment[]> {
    return this.active
      .filter(
        appointment =>
          appointment.client_id === client_id &&
          isAfter(appointment.end_date, now),
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async create(data: ICreateAppointmentDTO): Promise<Appointment> {
    const appointment = new Appointment();

    Object.assign(appointment, data, {
      id: randomUUID(),
      canceled_at: null,
      canceled_by: null,
      attendance: null,
      attendance_at: null,
      attendance_by: null,
      // No banco, preenchido pelo @CreateDateColumn
      created_at: new Date(),
    });

    this.appointments.push(appointment);

    return appointment;
  }

  public async save(appointment: Appointment): Promise<Appointment> {
    const index = this.appointments.findIndex(
      item => item.id === appointment.id,
    );

    this.appointments[index] = appointment;

    return appointment;
  }
}
export default AppointmentsRepository;
