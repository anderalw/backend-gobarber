import { Request, Response } from 'express';
import { container } from 'tsyringe';

import CheckSlotService from '@modules/appointments/services/CheckSlotService';

export default class ProviderSlotController {
  public async show(request: Request, response: Response): Promise<Response> {
    const checkSlot = container.resolve(CheckSlotService);

    const result = await checkSlot.execute({
      provider_id: request.params.provider_id,
      service_id: String(request.query.service_id),
      date: new Date(String(request.query.date)),
    });

    return response.json(result);
  }
}
