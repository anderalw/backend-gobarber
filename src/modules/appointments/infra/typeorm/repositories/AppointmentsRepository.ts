import {
  getRepository,
  Repository,
  Between,
  LessThan,
  MoreThan,
  QueryFailedError,
} from 'typeorm';
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from 'date-fns';

import AppError from '@shared/errors/AppError';

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

class AppointmentsRepository implements IAppointmentsRepository {
  private ormRepository: Repository<Appointment>;

  constructor() {
    this.ormRepository = getRepository(Appointment);
  }

  public async findOverlapping({
    provider_id,
    start,
    end,
  }: IFindOverlappingDTO): Promise<Appointment | undefined> {
    // Sobrepõe se começa antes do fim do novo e termina depois do início
    return this.ormRepository.findOne({
      where: {
        provider_id,
        date: LessThan(end),
        blocked_until: MoreThan(start),
      },
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
      where: { provider_id, date: dayRange(year, month, day) },
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
      where: { date: dayRange(year, month, day) },
      relations: ['client', 'service'],
      order: { date: 'ASC' },
    });
  }

  public async create(data: ICreateAppointmentDTO): Promise<Appointment> {
    const appointment = this.ormRepository.create(data);

    try {
      await this.ormRepository.save(appointment);
    } catch (err) {
      // 23P01 = exclusion_violation (AppointmentsNoOverlap): outra requisição
      // ocupou este horário entre a verificação do service e este insert
      const code = err instanceof QueryFailedError && (err as any).code;

      if (code === '23P01' || code === '23505') {
        throw new AppError('Este horário já está reservado.');
      }

      throw err;
    }

    return appointment;
  }
}
export default AppointmentsRepository;
