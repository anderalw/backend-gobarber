import {
  Repository,
  Between,
  IsNull,
  LessThan,
  MoreThan,
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
    } = appointment;

    try {
      await this.ormRepository.update(appointment.id, {
        provider_id,
        date,
        end_date,
        blocked_until,
        canceled_at,
        canceled_by,
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
