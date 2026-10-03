import { Request, Response } from 'express';
import { container } from 'tsyringe';

import RolesService from '@modules/users/services/RolesService';
import { PERMISSIONS } from '@modules/users/permissions';

// Perfis de acesso e o catálogo de permissões
export default class RolesController {
  public async index(request: Request, response: Response): Promise<Response> {
    return response.json(await container.resolve(RolesService).list());
  }

  public async permissions(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(PERMISSIONS);
  }

  public async create(request: Request, response: Response): Promise<Response> {
    const { name, permissions } = request.body;

    const role = await container
      .resolve(RolesService)
      .create({ name, permissions });

    return response.status(201).json(role);
  }

  public async update(request: Request, response: Response): Promise<Response> {
    const { name, permissions } = request.body;

    const role = await container
      .resolve(RolesService)
      .update(request.params.id, { name, permissions });

    return response.json(role);
  }

  public async delete(request: Request, response: Response): Promise<Response> {
    await container.resolve(RolesService).remove(request.params.id);

    return response.status(204).send();
  }
}
