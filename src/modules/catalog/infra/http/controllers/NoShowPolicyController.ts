import { Request, Response } from 'express';
import { container } from 'tsyringe';

import NoShowPolicyService from '@modules/appointments/services/NoShowPolicyService';

export default class NoShowPolicyController {
  public async show(request: Request, response: Response): Promise<Response> {
    const noShowPolicy = container.resolve(NoShowPolicyService);

    return response.json(await noShowPolicy.get());
  }

  public async update(request: Request, response: Response): Promise<Response> {
    const { alert_threshold, block_online } = request.body;

    const noShowPolicy = container.resolve(NoShowPolicyService);

    return response.json(
      await noShowPolicy.update({ alert_threshold, block_online }),
    );
  }
}
