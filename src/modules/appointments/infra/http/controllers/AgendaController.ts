import { Response, Request } from 'express';
import { container } from 'tsyringe';

import ListDayAgendaService from '@modules/appointments/services/ListDayAgendaService';

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
}
