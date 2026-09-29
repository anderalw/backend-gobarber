import { injectable, inject } from 'tsyringe';
import { format, isAfter, isBefore } from 'date-fns';

import AppError from '@shared/errors/AppError';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import RecurringTimeBlock from '../infra/typeorm/entities/RecurringTimeBlock';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';
import IBlockReasonsRepository from '../repositories/IBlockReasonsRepository';
import findBlockReason from '../utils/findBlockReason';
import expandRecurringBlocks from '../utils/expandRecurringBlocks';
import { ensureNoConflicts, findBlockProviders } from '../utils/blockConflicts';

interface IRequest {
  // Um ou mais barbeiros: cada um ganha a sua repetição
  provider_ids: string[];
  // 0 = domingo ... 6 = sábado
  days_of_week: number[];
  // 'HH:mm'
  start_time: string;
  end_time: string;
  // 'yyyy-MM-dd'; sem data de fim, vale até ser removido
  starts_on: string;
  ends_on?: string | null;
  // Motivo cadastrado (obrigatório); o bloqueio guarda o nome dele
  reason_id: string;
  requester_id: string;
}

// Bloqueio que se repete, como o almoço todos os dias das 12:00 às 13:30.
// Como no bloqueio avulso, é recusado se algum atendimento já marcado cair
// num dos dias bloqueados (de qualquer um dos barbeiros escolhidos)
@injectable()
class CreateRecurringTimeBlockService {
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
    days_of_week,
    start_time,
    end_time,
    starts_on,
    ends_on,
    reason_id,
    requester_id,
  }: IRequest): Promise<RecurringTimeBlock[]> {
    const days = Array.from(new Set(days_of_week)).sort();

    if (days.length === 0) {
      throw new AppError('Escolha pelo menos um dia da semana.');
    }

    // 'HH:mm' em ordem alfabética é a ordem do dia
    if (end_time <= start_time) {
      throw new AppError('O fim do bloqueio precisa ser depois do início.');
    }

    const endsOn = ends_on || null;
    const today = format(Date.now(), 'yyyy-MM-dd');

    if (endsOn && endsOn < starts_on) {
      throw new AppError('A data final precisa ser depois da inicial.');
    }

    if (endsOn && endsOn < today) {
      throw new AppError('Não é possível bloquear um período que já passou.');
    }

    const reason = await findBlockReason(
      this.blockReasonsRepository,
      reason_id,
    );

    const providers = await findBlockProviders(
      this.usersRepository,
      provider_ids,
    );

    const rule = Object.assign(new RecurringTimeBlock(), {
      id: 'nova',
      days_of_week: days,
      start_time,
      end_time,
      starts_on,
      ends_on: endsOn,
      reason: null,
    });

    // Atendimentos marcados que cairiam num dos dias bloqueados
    const conflicts = await Promise.all(
      providers.map(async provider => ({
        provider,
        appointments: (
          await this.appointmentsRepository.findUpcomingFromProvider(
            provider.id,
            new Date(Date.now()),
          )
        ).filter(appointment =>
          expandRecurringBlocks(
            [rule],
            appointment.date,
            appointment.end_date,
          ).some(
            period =>
              isBefore(period.start_date, appointment.end_date) &&
              isAfter(period.end_date, appointment.date),
          ),
        ),
      })),
    );

    ensureNoConflicts(conflicts, 'nesses horários', appointments => {
      const first = format(appointments[0].date, "dd/MM 'às' HH:mm");

      return appointments.length === 1
        ? `(${first})`
        : `(o primeiro em ${first})`;
    });

    return Promise.all(
      providers.map(provider =>
        this.timeBlocksRepository.createRecurring({
          provider_id: provider.id,
          days_of_week: days,
          start_time,
          end_time,
          starts_on,
          ends_on: endsOn,
          reason,
          created_by: requester_id,
        }),
      ),
    );
  }
}

export default CreateRecurringTimeBlockService;
