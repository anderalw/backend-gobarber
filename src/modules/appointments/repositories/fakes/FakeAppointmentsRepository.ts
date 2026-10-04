import { randomUUID } from 'crypto';
import { getMonth, getYear, getDate, isBefore, isAfter } from 'date-fns';
import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import ICreateAppointmentDTO from '@modules/appointments/dtos/ICreateAppointmentDTO';
import IFindAllInMonthFromProviderDTO from '@modules/appointments/dtos/IFindAllInMonthFromProviderDTO';
import IFindAllInDayFromProviderDTO from '@modules/appointments/dtos/IFindAllInDayFromProviderDTO';
import IFindAllInDayDTO from '@modules/appointments/dtos/IFindAllInDayDTO';
import IFindOverlappingDTO from '@modules/appointments/dtos/IFindOverlappingDTO';
import ISetAttendanceDTO from '@modules/appointments/dtos/ISetAttendanceDTO';
import IClientSummaryDTO from '@modules/appointments/dtos/IClientSummaryDTO';
import IClientVisitsDTO from '@modules/appointments/dtos/IClientVisitsDTO';

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

  public async findAwaitingConfirmationRequest(
    start: Date,
    end: Date,
  ): Promise<Appointment[]> {
    return this.active
      .filter(
        appointment =>
          !appointment.confirmation_requested_at &&
          !isBefore(appointment.date, start) &&
          !isAfter(appointment.date, end),
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async markConfirmationRequested(
    id: string,
    token: string,
    requested_at: Date,
  ): Promise<boolean> {
    const appointment = this.appointments.find(item => item.id === id);

    if (!appointment || appointment.confirmation_requested_at) return false;

    appointment.confirmation_token = token;
    appointment.confirmation_requested_at = requested_at;

    return true;
  }

  public async findByConfirmationToken(
    token: string,
  ): Promise<Appointment | undefined> {
    return this.appointments.find(
      appointment => !!token && appointment.confirmation_token === token,
    );
  }

  public async markConfirmed(
    id: string,
    confirmed_at: Date | null,
    confirmed_by: string | null = null,
  ): Promise<void> {
    const appointment = this.appointments.find(item => item.id === id);

    if (appointment) {
      appointment.confirmed_at = confirmed_at;
      appointment.confirmed_by = confirmed_by;
    }
  }

  public async summarizeByClients(
    client_ids: string[],
    now: Date,
    recentCount: number,
  ): Promise<IClientSummaryDTO[]> {
    return client_ids
      .map(client_id => {
        const mine = this.appointments.filter(
          item => item.client_id === client_id,
        );
        const completed = mine.filter(item => item.attendance === 'completed');
        const noShows = mine.filter(item => item.attendance === 'no_show');
        const upcoming = mine
          .filter(item => !item.canceled_at && isAfter(item.date, now))
          .sort((a, b) => a.date.getTime() - b.date.getTime());
        const lastVisit = completed
          .map(item => item.date)
          .sort((a, b) => b.getTime() - a.getTime())[0];

        return {
          client_id,
          count: mine.length,
          completed: completed.length,
          no_shows: noShows.length,
          recent_no_shows: mine
            .filter(item => !item.canceled_at && isBefore(item.date, now))
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, recentCount)
            .filter(item => item.attendance === 'no_show').length,
          canceled: mine.filter(item => item.canceled_at).length,
          total_cents: completed.reduce(
            (sum, item) => sum + (item.paid_cents ?? item.price_cents ?? 0),
            0,
          ),
          last_visit: lastVisit || null,
          next_appointment: upcoming[0]?.date || null,
        };
      })
      .filter(summary => summary.count > 0)
      .map(({ count: _, ...summary }) => summary);
  }

  public async clientVisits(now: Date): Promise<IClientVisitsDTO[]> {
    const ids = Array.from(
      new Set(
        this.appointments.flatMap(item =>
          item.client_id ? [item.client_id] : [],
        ),
      ),
    );

    return ids.map(client_id => {
      const mine = this.appointments.filter(
        item => item.client_id === client_id,
      );
      const dates = mine
        .filter(item => item.attendance === 'completed')
        .map(item => item.date)
        .sort((a, b) => a.getTime() - b.getTime());

      return {
        client_id,
        first_visit: dates[0] || null,
        last_visit: dates[dates.length - 1] || null,
        visits: dates.length,
        total_cents: mine
          .filter(item => item.attendance === 'completed')
          .reduce(
            (sum, item) => sum + (item.paid_cents ?? item.price_cents ?? 0),
            0,
          ),
        has_upcoming: mine.some(
          item => !item.canceled_at && isAfter(item.date, now),
        ),
      };
    });
  }

  public async findFollowingInSeries(
    series_id: string,
    from: Date,
  ): Promise<Appointment[]> {
    return this.active
      .filter(
        item => item.series_id === series_id && !isBefore(item.date, from),
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async findByMembershipInPeriod(
    membership_id: string,
    start: Date,
    end: Date,
  ): Promise<Appointment[]> {
    return this.active
      .filter(
        item =>
          item.membership_id === membership_id &&
          !isBefore(item.date, start) &&
          isBefore(item.date, end),
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  public async findAllFromClient(client_id: string): Promise<Appointment[]> {
    return this.appointments
      .filter(item => item.client_id === client_id)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
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
      series_id: data.series_id ?? null,
      membership_id: data.membership_id ?? null,
      list_price_cents: data.list_price_cents ?? null,
      package_id: data.package_id ?? null,
      deposit_cents: data.deposit_cents ?? null,
      deposit_paid_at: null,
      deposit_method: null,
      deposit_received_by: null,
      canceled_at: null,
      canceled_by: null,
      attendance: null,
      attendance_at: null,
      attendance_by: null,
      payment_method: null,
      paid_cents: null,
      confirmation_token: null,
      confirmation_requested_at: null,
      confirmed_at: null,
      confirmed_by: null,
      // No banco, preenchido pelo @CreateDateColumn
      created_at: new Date(),
    });

    this.appointments.push(appointment);

    return appointment;
  }

  public async findDepositsPaidInPeriod(
    start: Date,
    end: Date,
  ): Promise<Appointment[]> {
    return this.appointments.filter(
      item =>
        item.deposit_paid_at &&
        !isBefore(item.deposit_paid_at, start) &&
        !isAfter(item.deposit_paid_at, end),
    );
  }

  public async findByPackages(package_ids: string[]): Promise<Appointment[]> {
    return this.active.filter(
      item => item.package_id && package_ids.includes(item.package_id),
    );
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
