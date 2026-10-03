import { Response, Request } from 'express';
import { container } from 'tsyringe';

import { staffOf } from '@shared/infra/http/middlewares/ensurePermission';
import ListDayAgendaService from '@modules/appointments/services/ListDayAgendaService';
import ListWeekAgendaService from '@modules/appointments/services/ListWeekAgendaService';

type IDayAgenda = Awaited<ReturnType<ListDayAgendaService['execute']>>;

// Sem a permissão de ver a agenda de todos, só a coluna da própria pessoa
// (um usuário que não é barbeiro fica com a agenda vazia)
async function visibleTo<T extends IDayAgenda>(
  request: Request,
  agenda: T,
): Promise<T> {
  const user = await staffOf(request);

  if (user.can('agenda.all')) return agenda;

  return {
    ...agenda,
    providers: agenda.providers.filter(item => item.id === user.id),
    appointments: agenda.appointments.filter(
      item => item.provider_id === user.id,
    ),
    blocks: agenda.blocks.filter(item => item.provider_id === user.id),
  };
}

export default class AgendaController {
  public async index(request: Request, response: Response): Promise<Response> {
    const { day, month, year } = request.query;

    const listDayAgenda = container.resolve(ListDayAgendaService);

    const agenda = await listDayAgenda.execute({
      day: Number(day),
      month: Number(month),
      year: Number(year),
    });

    return response.json(await visibleTo(request, agenda));
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

    return response.json(
      await Promise.all(week.map(agenda => visibleTo(request, agenda))),
    );
  }
}
