import {
  Repository,
  Between,
  IsNull,
  LessThan,
  MoreThan,
  MoreThanOrEqual,
  Not,
  QueryFailedError,
} from 'typeorm';
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from 'date-fns';

import AppError from '@shared/errors/AppError';
import dataSource from '@shared/infra/typeorm/dataSource';

import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import ICreateAppointmentDTO from '@modules/appointments/dtos/ICreateAppointmentDTO';
import IFindAllInMonthFromProviderDTO from '@modules/appointments/dtos/IFindAllInMonthFromProviderDTO';
import IFindAllInDayFromProviderDTO from '@modules/appointments/dtos/IFindAllInDayFromProviderDTO';
import IFindAllInDayDTO from '@modules/appointments/dtos/IFindAllInDayDTO';
import IFindOverlappingDTO from '@modules/appointments/dtos/IFindOverlappingDTO';
import ISetAttendanceDTO from '@modules/appointments/dtos/ISetAttendanceDTO';
import IClientSummaryDTO from '@modules/appointments/dtos/IClientSummaryDTO';

import Appointment from '../entities/Appointment';

// Início e fim do dia no horário local do servidor. Antes o filtro usava
// to_char(date) no fuso do banco (UTC): um agendamento às 21h de Brasília
// (meia-noite UTC) caía no dia seguinte
function dayRange(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);

  return Between(startOfDay(date), endOfDay(date));
}

// Cancelados não ocupam horário nem aparecem na agenda
const ACTIVE = { canceled_at: IsNull() };

// 23P01 = exclusion_violation (AppointmentsNoOverlap): outra requisição ocupou
// o horário entre a verificação do service e a gravação
function isOverlapError(err: unknown): boolean {
  const code =
    err instanceof QueryFailedError && (err as { code?: string }).code;

  return code === '23P01' || code === '23505';
}

class AppointmentsRepository implements IAppointmentsRepository {
  private ormRepository: Repository<Appointment>;

  constructor() {
    this.ormRepository = dataSource.getRepository(Appointment);
  }

  public async findById(id: string): Promise<Appointment | undefined> {
    // No TypeORM 0.3 um where com id undefined é ignorado e traria o
    // primeiro registro; sem id não há o que buscar
    if (!id) return undefined;

    const appointment = await this.ormRepository.findOne({
      where: { id },
      relations: ['client', 'provider', 'service'],
    });

    return appointment ?? undefined;
  }

  public async findOverlapping({
    provider_id,
    start,
    end,
    except_appointment_id,
  }: IFindOverlappingDTO): Promise<Appointment | undefined> {
    // Sobrepõe se começa antes do fim do novo e termina depois do início
    const appointment = await this.ormRepository.findOne({
      where: {
        ...ACTIVE,
        ...(except_appointment_id && { id: Not(except_appointment_id) }),
        provider_id,
        date: LessThan(end),
        blocked_until: MoreThan(start),
      },
    });

    return appointment ?? undefined;
  }

  public async findInRangeFromProvider({
    provider_id,
    start,
    end,
  }: IFindOverlappingDTO): Promise<Appointment[]> {
    return this.ormRepository.find({
      where: {
        ...ACTIVE,
        provider_id,
        date: LessThan(end),
        end_date: MoreThan(start),
      },
      order: { date: 'ASC' },
    });
  }

  public async findAllInMonthFromProvider({
    provider_id,
    month,
    year,
  }: IFindAllInMonthFromProviderDTO): Promise<Appointment[]> {
    const date = new Date(year, month - 1, 1);

    return this.ormRepository.find({
      where: {
        ...ACTIVE,
        provider_id,
        date: Between(startOfMonth(date), endOfMonth(date)),
      },
    });
  }

  public async findAllInDayFromProvider({
    provider_id,
    day,
    month,
    year,
  }: IFindAllInDayFromProviderDTO): Promise<Appointment[]> {
    return this.ormRepository.find({
      where: { ...ACTIVE, provider_id, date: dayRange(year, month, day) },
      relations: ['client', 'service'],
      order: { date: 'ASC' },
    });
  }

  public async findAllInDay({
    day,
    month,
    year,
  }: IFindAllInDayDTO): Promise<Appointment[]> {
    return this.ormRepository.find({
      where: { ...ACTIVE, date: dayRange(year, month, day) },
      relations: ['client', 'service'],
      order: { date: 'ASC' },
    });
  }

  public async findUpcomingFromClient(
    client_id: string,
    now: Date,
  ): Promise<Appointment[]> {
    return this.ormRepository.find({
      where: { ...ACTIVE, client_id, end_date: MoreThan(now) },
      relations: ['provider', 'service'],
      order: { date: 'ASC' },
    });
  }

  public async findUpcomingFromProvider(
    provider_id: string,
    now: Date,
  ): Promise<Appointment[]> {
    return this.ormRepository.find({
      where: { ...ACTIVE, provider_id, end_date: MoreThan(now) },
      order: { date: 'ASC' },
    });
  }

  public async setAttendance({
    appointment_id,
    attendance,
    attendance_at,
    attendance_by,
  }: ISetAttendanceDTO): Promise<void> {
    await this.ormRepository.update(appointment_id, {
      attendance,
      attendance_at,
      attendance_by,
    });
  }

  public async findAllInPeriod(start: Date, end: Date): Promise<Appointment[]> {
    return this.ormRepository.find({
      where: { date: Between(start, end) },
      relations: ['provider', 'service'],
      order: { date: 'ASC' },
    });
  }

  public async findAwaitingConfirmationRequest(
    start: Date,
    end: Date,
  ): Promise<Appointment[]> {
    return this.ormRepository.find({
      where: {
        ...ACTIVE,
        confirmation_requested_at: IsNull(),
        date: Between(start, end),
      },
      relations: ['client', 'provider', 'service'],
      order: { date: 'ASC' },
    });
  }

  public async markConfirmationRequested(
    id: string,
    token: string,
    requested_at: Date,
  ): Promise<boolean> {
    const result = await this.ormRepository.update(
      { id, confirmation_requested_at: IsNull() },
      { confirmation_token: token, confirmation_requested_at: requested_at },
    );

    return (result.affected || 0) > 0;
  }

  public async findByConfirmationToken(
    token: string,
  ): Promise<Appointment | undefined> {
    // Sem token o TypeORM 0.3 ignoraria o filtro e traria o primeiro registro
    if (!token) return undefined;

    const appointment = await this.ormRepository.findOne({
      where: { confirmation_token: token },
      relations: ['client', 'provider', 'service'],
    });

    return appointment ?? undefined;
  }

  public async markConfirmed(
    id: string,
    confirmed_at: Date | null,
    confirmed_by: string | null = null,
  ): Promise<void> {
    await this.ormRepository.update(id, { confirmed_at, confirmed_by });
  }

  public async summarizeByClients(
    client_ids: string[],
    now: Date,
    recentCount: number,
  ): Promise<IClientSummaryDTO[]> {
    if (client_ids.length === 0) return [];

    const rows: Array<Record<string, string | Date | null>> =
      await this.ormRepository.query(
        `SELECT a.client_id,
          COUNT(*) FILTER (WHERE a.attendance = 'completed') AS completed,
          COUNT(*) FILTER (WHERE a.attendance = 'no_show') AS no_shows,
          COALESCE(r.recent_no_shows, 0) AS recent_no_shows,
          COUNT(*) FILTER (WHERE a.canceled_at IS NOT NULL) AS canceled,
          COALESCE(SUM(a.price_cents) FILTER (WHERE a.attendance = 'completed'), 0) AS total_cents,
          MAX(a.date) FILTER (WHERE a.attendance = 'completed') AS last_visit,
          MIN(a.date) FILTER (WHERE a.canceled_at IS NULL AND a.date > $2) AS next_appointment
        FROM appointments a
        LEFT JOIN (
          SELECT client_id,
            COUNT(*) FILTER (WHERE attendance = 'no_show') AS recent_no_shows
          FROM (
            SELECT client_id, attendance,
              ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY date DESC) AS position
            FROM appointments
            WHERE client_id = ANY($1::uuid[])
              AND canceled_at IS NULL
              AND date < $2
          ) ranked
          WHERE position <= $3
          GROUP BY client_id
        ) r ON r.client_id = a.client_id
        WHERE a.client_id = ANY($1::uuid[])
        GROUP BY a.client_id, r.recent_no_shows`,
        [client_ids, now, recentCount],
      );

    return rows.map(row => ({
      client_id: String(row.client_id),
      completed: Number(row.completed),
      no_shows: Number(row.no_shows),
      recent_no_shows: Number(row.recent_no_shows),
      canceled: Number(row.canceled),
      total_cents: Number(row.total_cents),
      last_visit: row.last_visit ? new Date(row.last_visit) : null,
      next_appointment: row.next_appointment
        ? new Date(row.next_appointment)
        : null,
    }));
  }

  public async findFollowingInSeries(
    series_id: string,
    from: Date,
  ): Promise<Appointment[]> {
    if (!series_id) return [];

    return this.ormRepository.find({
      where: { ...ACTIVE, series_id, date: MoreThanOrEqual(from) },
      relations: ['client', 'provider', 'service'],
      order: { date: 'ASC' },
    });
  }

  public async findAllFromClient(client_id: string): Promise<Appointment[]> {
    if (!client_id) return [];

    return this.ormRepository.find({
      where: { client_id },
      relations: ['provider', 'service'],
      order: { date: 'DESC' },
    });
  }

  public async countUpcomingFromProvider(
    provider_id: string,
    now: Date,
  ): Promise<number> {
    return this.ormRepository.count({
      where: { ...ACTIVE, provider_id, end_date: MoreThan(now) },
    });
  }

  public async create(data: ICreateAppointmentDTO): Promise<Appointment> {
    const appointment = this.ormRepository.create(data);

    try {
      await this.ormRepository.save(appointment);
    } catch (err) {
      if (isOverlapError(err)) {
        throw new AppError('Este horário já está reservado.');
      }

      throw err;
    }

    return appointment;
  }

  public async save(appointment: Appointment): Promise<Appointment> {
    // Grava só as colunas que remarcar/cancelar alteram. Com save(), a relação
    // provider carregada teria prioridade sobre um provider_id novo
    const {
      provider_id,
      date,
      end_date,
      blocked_until,
      canceled_at,
      canceled_by,
      confirmation_token,
      confirmation_requested_at,
      confirmed_at,
      confirmed_by,
    } = appointment;

    try {
      await this.ormRepository.update(appointment.id, {
        provider_id,
        date,
        end_date,
        blocked_until,
        canceled_at,
        canceled_by,
        // Remarcar zera a confirmação (o novo horário é confirmado de novo)
        confirmation_token,
        confirmation_requested_at,
        confirmed_at,
        confirmed_by,
      });
    } catch (err) {
      if (isOverlapError(err)) {
        throw new AppError('Este horário já está reservado.');
      }

      throw err;
    }

    return (await this.findById(appointment.id)) as Appointment;
  }
}
export default AppointmentsRepository;
