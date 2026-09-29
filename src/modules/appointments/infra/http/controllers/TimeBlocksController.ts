import { Request, Response } from 'express';
import { container } from 'tsyringe';

import CreateTimeBlockService from '@modules/appointments/services/CreateTimeBlockService';
import CreateRecurringTimeBlockService from '@modules/appointments/services/CreateRecurringTimeBlockService';
import DeleteTimeBlockService from '@modules/appointments/services/DeleteTimeBlockService';

export default class TimeBlocksController {
  public async create(request: Request, response: Response): Promise<Response> {
    const { provider_ids, start_date, end_date, reason_id } = request.body;

    const createTimeBlock = container.resolve(CreateTimeBlockService);

    const blocks = await createTimeBlock.execute({
      provider_ids,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      reason_id,
      requester_id: request.user.id,
    });

    return response.status(201).json(blocks);
  }

  // Bloqueio que se repete nos dias da semana escolhidos
  public async createRecurring(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const {
      provider_ids,
      days_of_week,
      start_time,
      end_time,
      starts_on,
      ends_on,
      reason_id,
    } = request.body;

    const createRecurring = container.resolve(CreateRecurringTimeBlockService);

    const rules = await createRecurring.execute({
      provider_ids,
      days_of_week,
      start_time,
      end_time,
      starts_on,
      ends_on,
      reason_id,
      requester_id: request.user.id,
    });

    return response.status(201).json(rules);
  }

  public async delete(request: Request, response: Response): Promise<Response> {
    const deleteTimeBlock = container.resolve(DeleteTimeBlockService);

    await deleteTimeBlock.execute(request.params.id);

    return response.status(204).send();
  }
}
