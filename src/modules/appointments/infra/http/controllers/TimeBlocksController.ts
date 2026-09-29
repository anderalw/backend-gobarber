import { Request, Response } from 'express';
import { container } from 'tsyringe';

import CreateTimeBlockService from '@modules/appointments/services/CreateTimeBlockService';
import DeleteTimeBlockService from '@modules/appointments/services/DeleteTimeBlockService';

export default class TimeBlocksController {
  public async create(request: Request, response: Response): Promise<Response> {
    const { provider_id, start_date, end_date, reason } = request.body;

    const createTimeBlock = container.resolve(CreateTimeBlockService);

    const block = await createTimeBlock.execute({
      provider_id,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      reason,
      requester_id: request.user.id,
    });

    return response.status(201).json(block);
  }

  public async delete(request: Request, response: Response): Promise<Response> {
    const deleteTimeBlock = container.resolve(DeleteTimeBlockService);

    await deleteTimeBlock.execute(request.params.id);

    return response.status(204).send();
  }
}
