import { Request, Response } from 'express';
import { container } from 'tsyringe';

import StaffUsersService from '@modules/users/services/StaffUsersService';
import SetProviderActiveService from '@modules/users/services/SetProviderActiveService';

// Usuários da equipe (menu Usuários)
export default class StaffUsersController {
  public async index(request: Request, response: Response): Promise<Response> {
    return response.json(await container.resolve(StaffUsersService).list());
  }

  public async create(request: Request, response: Response): Promise<Response> {
    const { name, email, password, role_id } = request.body;

    const user = await container
      .resolve(StaffUsersService)
      .create({ name, email, password, role_id });

    return response.status(201).json(user);
  }

  public async update(request: Request, response: Response): Promise<Response> {
    const { name, email, role_id, password } = request.body;

    const user = await container
      .resolve(StaffUsersService)
      .update(request.user.id, request.params.id, {
        name,
        email,
        role_id,
        password,
      });

    return response.json(user);
  }

  public async setActive(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const user = await container.resolve(SetProviderActiveService).execute({
      requester_id: request.user.id,
      provider_id: request.params.id,
      active: request.body.active,
    });

    return response.json(StaffUsersService.view(user));
  }
}
