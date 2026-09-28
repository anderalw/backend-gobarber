import { Request, Response } from 'express';
import { container } from 'tsyringe';
import UpdateProviderSchedulesService from '@modules/users/services/UpdateProviderSchedulesService';

export default class ProviderSchedulesController {
  public async update(request: Request, response: Response): Promise<Response> {
    const { provider_id } = request.params;
    const { schedules } = request.body;

    const updateProviderSchedules = container.resolve(
      UpdateProviderSchedulesService,
    );

    const providerSchedules = await updateProviderSchedules.execute({
      provider_id,
      schedules,
    });

    return response.json(providerSchedules);
  }
}
