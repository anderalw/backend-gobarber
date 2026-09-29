import { injectable, inject } from 'tsyringe';
import {
  differenceInDays,
  isAfter,
  isBefore,
  setMilliseconds,
  setSeconds,
} from 'date-fns';

import AppError from '@shared/errors/AppError';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import TimeBlock from '../infra/typeorm/entities/TimeBlock';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';

interface IRequest {
  provider_id: string;
  start_date: Date;
  end_date: Date;
  reason?: string | null;
  // Barbeiro logado que está bloqueando (a agenda é compartilhada)
  requester_id: string;
}

// Limite para um bloqueio só (ex: férias)
export const MAX_BLOCK_DAYS = 90;

const minute = (date: Date): Date => setMilliseconds(setSeconds(date, 0), 0);

// Bloqueia um período na agenda de um barbeiro. Se já houver atendimentos
// marcados no período, o bloqueio é recusado: eles precisam ser cancelados
// ou remarcados antes, para nenhum cliente ficar com horário num bloqueio
@injectable()
class CreateTimeBlockService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('TimeBlocksRepository')
    private timeBlocksRepository: ITimeBlocksRepository,
  ) {}

  public async execute({
    provider_id,
    start_date,
    end_date,
    reason,
    requester_id,
  }: IRequest): Promise<TimeBlock> {
    const start = minute(start_date);
    const end = minute(end_date);

    if (!isAfter(end, start)) {
      throw new AppError('O fim do bloqueio precisa ser depois do início.');
    }

    if (!isAfter(end, Date.now())) {
      throw new AppError('Não é possível bloquear um período que já passou.');
    }

    if (differenceInDays(end, start) > MAX_BLOCK_DAYS) {
      throw new AppError(
        `Um bloqueio pode ter no máximo ${MAX_BLOCK_DAYS} dias.`,
      );
    }

    const provider = await this.usersRepository.findById(provider_id);

    if (!provider) {
      throw new AppError('Barbeiro não encontrado.');
    }

    const appointments =
      await this.appointmentsRepository.findInRangeFromProvider({
        provider_id,
        start,
        end,
      });

    // Atendimentos que já terminaram não impedem (ex: bloquear o resto do dia)
    const pending = appointments.filter(appointment =>
      isBefore(Date.now(), appointment.end_date),
    );

    if (pending.length > 0) {
      throw new AppError(
        pending.length === 1
          ? 'Há 1 agendamento neste período. Cancele ou remarque antes de bloquear.'
          : `Há ${pending.length} agendamentos neste período. Cancele ou remarque antes de bloquear.`,
      );
    }

    return this.timeBlocksRepository.create({
      provider_id,
      start_date: start,
      end_date: end,
      reason: reason?.trim() || null,
      created_by: requester_id,
    });
  }
}

export default CreateTimeBlockService;
