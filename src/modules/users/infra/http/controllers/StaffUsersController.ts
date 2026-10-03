import { Request, Response } from 'express';
import { container } from 'tsyringe';

import StaffUsersService from '@modules/users/services/StaffUsersService';
import SetProviderActiveService from '@modules/users/services/SetProviderActiveService';
import ProfileFieldsService from '@modules/catalog/services/ProfileFieldsService';

// Usuários da equipe (menu Usuários)
export default class StaffUsersController {
  public async index(request: Request, response: Response): Promise<Response> {
    return response.json(await container.resolve(StaffUsersService).list());
  }

  public async show(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container.resolve(StaffUsersService).show(request.params.id),
    );
  }

  public async create(request: Request, response: Response): Promise<Response> {
    const { name, email, role_id, permissions } = request.body;

    const user = await container
      .resolve(StaffUsersService)
      .create({ name, email, role_id, permissions });

    return response.status(201).json(user);
  }

  public async update(request: Request, response: Response): Promise<Response> {
    const { name, email, role_id, permissions } = request.body;
    const extras = await container
      .resolve(ProfileFieldsService)
      .check('staff', request.body);

    const user = await container
      .resolve(StaffUsersService)
      .update(
        request.user.id,
        request.params.id,
        { name, email, role_id, permissions },
        extras,
      );

    return response.json(user);
  }

  // Volta para a senha provisória (o e-mail)
  public async resetPassword(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const user = await container
      .resolve(StaffUsersService)
      .resetPassword(request.user.id, request.params.id);

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
