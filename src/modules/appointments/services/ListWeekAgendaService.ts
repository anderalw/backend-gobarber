import { injectable, inject } from 'tsyringe';
import { addDays, format } from 'date-fns';

import ListDayAgendaService from './ListDayAgendaService';

interface IRequest {
  // Primeiro dia da semana mostrada
  day: number;
  month: number;
  year: number;
}

type IDayAgenda = Awaited<ReturnType<ListDayAgendaService['execute']>>;

type IResponse = Array<IDayAgenda & { date: string }>;

// Visão semanal: os sete dias a partir do pedido, cada um igual à agenda
// do dia, numa única requisição
@injectable()
class ListWeekAgendaService {
  constructor(
    @inject(ListDayAgendaService)
    private listDayAgenda: ListDayAgendaService,
  ) {}

  public async execute({ day, month, year }: IRequest): Promise<IResponse> {
    const first = new Date(year, month - 1, day);

    return Promise.all(
      Array.from({ length: 7 }, async (_, index) => {
        const date = addDays(first, index);

        const agenda = await this.listDayAgenda.execute({
          day: date.getDate(),
          month: date.getMonth() + 1,
          year: date.getFullYear(),
        });

        return { date: format(date, 'yyyy-MM-dd'), ...agenda };
      }),
    );
  }
}

export default ListWeekAgendaService;
