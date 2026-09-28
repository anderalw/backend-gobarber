import { Response, Request } from 'express';
import { container } from 'tsyringe';

import ListAnyProviderDayAvailabilityService from '@modules/appointments/services/ListAnyProviderDayAvailabilityService';

export default class AnyProviderDayAvailabilityController {
  public async index(request: Request, response: Response): Promise<Response> {
    const { day, month, year, service_id } = request.query;

    const listAnyProviderDayAvailability = container.resolve(
      ListAnyProviderDayAvailabilityService,
    );

    const availability = await listAnyProviderDayAvailability.execute({
      service_id: String(service_id),
      day: Number(day),
      month: Number(month),
      year: Number(year),
    });

    return response.json(availability);
  }
}
