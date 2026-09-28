import { Request, Response } from 'express';
import { container } from 'tsyringe';

import SuggestSlotsService from '@modules/appointments/services/SuggestSlotsService';

export default class ProviderSuggestionsController {
  public async index(request: Request, response: Response): Promise<Response> {
    const suggestSlots = container.resolve(SuggestSlotsService);

    const suggestions = await suggestSlots.execute({
      provider_id: request.params.provider_id,
      service_id: String(request.query.service_id),
      date: new Date(String(request.query.date)),
    });

    return response.json(suggestions);
  }
}
