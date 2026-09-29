import { injectable, inject } from 'tsyringe';
import { format, isAfter, isBefore } from 'date-fns';

import AppError from '@shared/errors/AppError';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import RecurringTimeBlock from '../infra/typeorm/entities/RecurringTimeBlock';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';
import expandRecurringBlocks from '../utils/expandRecurringBlocks';

interface IRequest {
  provider_id: string;
  // 0 = domingo ... 6 = sábado
  days_of_week: number[];
  // 'HH:mm'
  start_time: string;
  end_time: string;
  // 'yyyy-MM-dd'; sem data de fim, vale até ser removido
  starts_on: string;
  ends_on?: string | null;
  reason?: string | null;
  requester_id: string;
}

// Bloqueio que se repete, como o almoço todos os dias das 12:00 às 13:30.
// Como no bloqueio avulso, é recusado se algum atendimento já marcado cair
// num dos dias bloqueados
@injectable()
class CreateRecurringTimeBlockService {
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
    days_of_week,
    start_time,
    end_time,
    starts_on,
    ends_on,
    reason,
    requester_id,
  }: IRequest): Promise<RecurringTimeBlock> {
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

    const provider = await this.usersRepository.findById(provider_id);

    if (!provider) {
      throw new AppError('Barbeiro não encontrado.');
    }

    const rule = Object.assign(new RecurringTimeBlock(), {
      id: 'nova',
      provider_id,
      days_of_week: days,
      start_time,
      end_time,
      starts_on,
      ends_on: endsOn,
      reason: null,
    });

    // Atendimentos marcados que cairiam num dos dias bloqueados
    const upcoming = await this.appointmentsRepository.findUpcomingFromProvider(
      provider_id,
      new Date(Date.now()),
    );
    const conflicts = upcoming.filter(appointment =>
      expandRecurringBlocks(
        [rule],
        appointment.date,
        appointment.end_date,
      ).some(
        period =>
          isBefore(period.start_date, appointment.end_date) &&
          isAfter(period.end_date, appointment.date),
      ),
    );

    if (conflicts.length > 0) {
      const first = format(conflicts[0].date, "dd/MM 'às' HH:mm");

      throw new AppError(
        conflicts.length === 1
          ? `Há 1 agendamento nesses horários (${first}). Cancele ou remarque antes de bloquear.`
          : `Há ${conflicts.length} agendamentos nesses horários (o primeiro em ${first}). Cancele ou remarque antes de bloquear.`,
      );
    }

    return this.timeBlocksRepository.createRecurring({
      provider_id,
      days_of_week: days,
      start_time,
      end_time,
      starts_on,
      ends_on: endsOn,
      reason: reason?.trim() || null,
      created_by: requester_id,
    });
  }
}

export default CreateRecurringTimeBlockService;
