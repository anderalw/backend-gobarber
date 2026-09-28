import { Response, Request } from 'express';
import { container } from 'tsyringe';

import ListDayAgendaService from '@modules/appointments/services/ListDayAgendaService';
import ListWeekAgendaService from '@modules/appointments/services/ListWeekAgendaService';

export default class AgendaController {
  public async index(request: Request, response: Response): Promise<Response> {
    const { day, month, year } = request.query;

    const listDayAgenda = container.resolve(ListDayAgendaService);

    const agenda = await listDayAgenda.execute({
      day: Number(day),
      month: Number(month),
      year: Number(year),
    });

    return response.json(agenda);
  }

  // Sete dias a partir da data pedida
  public async week(request: Request, response: Response): Promise<Response> {
    const { day, month, year } = request.query;

    const listWeekAgenda = container.resolve(ListWeekAgendaService);

    const week = await listWeekAgenda.execute({
      day: Number(day),
      month: Number(month),
      year: Number(year),
    });

    return response.json(week);
  }
}
