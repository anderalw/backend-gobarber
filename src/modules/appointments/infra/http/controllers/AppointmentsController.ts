import { Response, Request } from 'express';
import { parseISO } from 'date-fns';
import { container } from 'tsyringe';

import CreateAppointmetsServices from '@modules/appointments/services/CreateAppointmentService';

export default class AppointmentsController {
  public async create(request: Request, response: Response): Promise<Response> {
    const { provider_id, date } = request.body;

    const parsedDate = parseISO(date);

    const createAppointmets = container.resolve(CreateAppointmetsServices);

    const appointment = await createAppointmets.execute({
      date: parsedDate,
      provider_id,
    });

    return response.json(appointment);
  }
}
