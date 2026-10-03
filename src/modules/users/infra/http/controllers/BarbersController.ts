import { Request, Response } from 'express';
import { container } from 'tsyringe';

import ListTeamService from '@modules/users/services/ListTeamService';
import BarbersService from '@modules/users/services/BarbersService';
import StaffUsersService from '@modules/users/services/StaffUsersService';

// Barbeiros (menu Barbeiros): quem atende, com os horários de trabalho
export default class BarbersController {
  public async index(request: Request, response: Response): Promise<Response> {
    return response.json(await container.resolve(ListTeamService).execute());
  }

  public async create(request: Request, response: Response): Promise<Response> {
    const user = await container
      .resolve(BarbersService)
      .add(request.body.user_id);

    return response.status(201).json(StaffUsersService.view(user));
  }

  public async delete(request: Request, response: Response): Promise<Response> {
    await container.resolve(BarbersService).remove(request.params.id);

    return response.status(204).send();
  }
}
