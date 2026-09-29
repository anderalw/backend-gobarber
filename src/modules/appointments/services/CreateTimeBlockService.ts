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
import IBlockReasonsRepository from '../repositories/IBlockReasonsRepository';
import findBlockReason from '../utils/findBlockReason';
import { ensureNoConflicts, findBlockProviders } from '../utils/blockConflicts';

interface IRequest {
  // Um ou mais barbeiros: o mesmo período fica bloqueado para todos
  provider_ids: string[];
  start_date: Date;
  end_date: Date;
  // Motivo cadastrado (obrigatório); o bloqueio guarda o nome dele
  reason_id: string;
  // Barbeiro logado que está bloqueando (a agenda é compartilhada)
  requester_id: string;
}

// Limite para um bloqueio só (ex: férias)
export const MAX_BLOCK_DAYS = 90;

const minute = (date: Date): Date => setMilliseconds(setSeconds(date, 0), 0);

// Bloqueia um período na agenda de um ou mais barbeiros. Se já houver
// atendimentos marcados no período, o bloqueio é recusado (para todos):
// eles precisam ser cancelados ou remarcados antes, para nenhum cliente
// ficar com horário num bloqueio
@injectable()
class CreateTimeBlockService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('TimeBlocksRepository')
    private timeBlocksRepository: ITimeBlocksRepository,

    @inject('BlockReasonsRepository')
    private blockReasonsRepository: IBlockReasonsRepository,
  ) {}

  public async execute({
    provider_ids,
    start_date,
    end_date,
    reason_id,
    requester_id,
  }: IRequest): Promise<TimeBlock[]> {
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

    const reason = await findBlockReason(
      this.blockReasonsRepository,
      reason_id,
    );

    const providers = await findBlockProviders(
      this.usersRepository,
      provider_ids,
    );

    const conflicts = await Promise.all(
      providers.map(async provider => ({
        provider,
        // Atendimentos que já terminaram não impedem (ex: bloquear o resto
        // do dia)
        appointments: (
          await this.appointmentsRepository.findInRangeFromProvider({
            provider_id: provider.id,
            start,
            end,
          })
        ).filter(appointment => isBefore(Date.now(), appointment.end_date)),
      })),
    );

    ensureNoConflicts(conflicts, 'neste período');

    return Promise.all(
      providers.map(provider =>
        this.timeBlocksRepository.create({
          provider_id: provider.id,
          start_date: start,
          end_date: end,
          reason,
          created_by: requester_id,
        }),
      ),
    );
  }
}

export default CreateTimeBlockService;
