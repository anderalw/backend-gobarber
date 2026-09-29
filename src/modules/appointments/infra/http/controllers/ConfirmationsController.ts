import { Request, Response } from 'express';
import { container } from 'tsyringe';

import ConfirmAppointmentService from '@modules/appointments/services/ConfirmAppointmentService';

export default class ConfirmationsController {
  public async create(request: Request, response: Response): Promise<Response> {
    const result = await container
      .resolve(ConfirmAppointmentService)
      .execute(request.params.token);

    return response.json(result);
  }
}
