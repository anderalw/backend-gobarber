import { Request, Response } from 'express';
import { container } from 'tsyringe';

import PackagesService from '@modules/packages/services/PackagesService';

export default class PackagesController {
  // Cliente: os próprios pacotes
  public async mine(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container.resolve(PackagesService).listByClient(request.user.id),
    );
  }

  public async index(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container
        .resolve(PackagesService)
        .listByClient(String(request.query.client_id)),
    );
  }

  public async create(request: Request, response: Response): Promise<Response> {
    const { client_id, service_id, sessions, price_cents, payment_method } =
      request.body;

    return response.status(201).json(
      await container.resolve(PackagesService).create({
        client_id,
        service_id,
        sessions,
        price_cents,
        payment_method,
        user_id: request.user.id,
      }),
    );
  }

  public async cancel(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container.resolve(PackagesService).cancel(request.params.id),
    );
  }
}
