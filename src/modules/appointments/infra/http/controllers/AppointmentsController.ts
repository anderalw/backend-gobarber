import { Response, Request } from 'express';
import { parseISO } from 'date-fns';
import { container } from 'tsyringe';

import CreateAppointmentsServices from '@modules/appointments/services/CreateAppointmentsService';

export default class AppointmentsController {
  public async create(request: Request, response: Response): Promise<Response> {
    const user_id = request.user.id;
    const { provider_id, date } = request.body;

    const parsedDate = parseISO(date);

    const createAppointmets = container.resolve(CreateAppointmentsServices);

    const appointment = await createAppointmets.execute({
      date: parsedDate,
      provider_id,
      user_id,
    });

    return response.json(appointment);
  }
}
