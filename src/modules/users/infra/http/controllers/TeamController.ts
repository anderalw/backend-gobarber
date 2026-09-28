import { Request, Response } from 'express';
import { container } from 'tsyringe';
import { instanceToInstance } from 'class-transformer';

import ListTeamService from '@modules/users/services/ListTeamService';
import UpdateProviderService from '@modules/users/services/UpdateProviderService';
import SetProviderActiveService from '@modules/users/services/SetProviderActiveService';

// Administração da equipe de barbeiros (só administradores)
export default class TeamController {
  public async index(request: Request, response: Response): Promise<Response> {
    const listTeam = container.resolve(ListTeamService);

    const team = await listTeam.execute();

    return response.json(team);
  }

  public async update(request: Request, response: Response): Promise<Response> {
    const { provider_id } = request.params;
    const { name, email } = request.body;

    const updateProvider = container.resolve(UpdateProviderService);

    const provider = await updateProvider.execute({ provider_id, name, email });

    return response.json(instanceToInstance(provider));
  }

  public async setActive(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { provider_id } = request.params;
    const { active } = request.body;

    const setProviderActive = container.resolve(SetProviderActiveService);

    const provider = await setProviderActive.execute({
      requester_id: request.user.id,
      provider_id,
      active,
    });

    return response.json(instanceToInstance(provider));
  }
}
