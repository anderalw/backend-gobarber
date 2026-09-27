import { Request, Response } from 'express';
import { container } from 'tsyringe';

import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';

export default class AgendaSettingsController {
  public async show(request: Request, response: Response): Promise<Response> {
    const agendaSettings = container.resolve(AgendaSettingsService);

    return response.json(await agendaSettings.get());
  }

  public async update(request: Request, response: Response): Promise<Response> {
    const { buffer_minutes } = request.body;

    const agendaSettings = container.resolve(AgendaSettingsService);

    return response.json(await agendaSettings.update({ buffer_minutes }));
  }
}
