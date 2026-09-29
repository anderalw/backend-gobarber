import { Request, Response } from 'express';
import { container } from 'tsyringe';

import BlockReasonsService from '@modules/appointments/services/BlockReasonsService';

export default class BlockReasonsController {
  public async index(request: Request, response: Response): Promise<Response> {
    const reasons = await container.resolve(BlockReasonsService).list();

    return response.json(reasons);
  }

  public async create(request: Request, response: Response): Promise<Response> {
    const reason = await container
      .resolve(BlockReasonsService)
      .create(request.body.name);

    return response.status(201).json(reason);
  }

  public async update(request: Request, response: Response): Promise<Response> {
    const reason = await container
      .resolve(BlockReasonsService)
      .update(request.params.id, request.body.name);

    return response.json(reason);
  }

  public async delete(request: Request, response: Response): Promise<Response> {
    await container.resolve(BlockReasonsService).delete(request.params.id);

    return response.status(204).send();
  }
}
