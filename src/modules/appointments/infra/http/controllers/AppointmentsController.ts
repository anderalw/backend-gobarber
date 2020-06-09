import { Response, Request } from 'express';
import { container } from 'tsyringe';

import CreateAppointmentsService from '@modules/appointments/services/CreateAppointmentsService';

export default class AppointmentsController {
  public async create(request: Request, response: Response): Promise<Response> {
    const user_id = request.user.id;
    const { provider_id, date } = request.body;

    const createAppointmets = container.resolve(CreateAppointmentsService);

    const appointment = await createAppointmets.execute({
      date,
      provider_id,
      user_id,
    });

    return response.json(appointment);
  }
}
