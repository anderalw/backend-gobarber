import { Request, Response } from 'express';
import { container } from 'tsyringe';

import CashRegisterService from '@modules/appointments/services/CashRegisterService';
import SetPaymentService from '@modules/appointments/services/SetPaymentService';
import SetAttendanceService from '@modules/appointments/services/SetAttendanceService';
import RegisterAttendancesService from '@modules/appointments/services/RegisterAttendancesService';

export default class CashController {
  public async show(request: Request, response: Response): Promise<Response> {
    const cash = container.resolve(CashRegisterService);

    return response.json(await cash.show(String(request.query.date)));
  }

  public async close(request: Request, response: Response): Promise<Response> {
    const { date, opening_cents, counted_cents, notes } = request.body;

    const cash = container.resolve(CashRegisterService);

    return response.json(
      await cash.close({
        date,
        opening_cents,
        counted_cents,
        notes,
        user_id: request.user.id,
      }),
    );
  }

  public async attendances(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const register = container.resolve(RegisterAttendancesService);

    const count = await register.execute({
      items: request.body.items,
      requester_id: request.user.id,
    });

    return response.json({ count });
  }

  // Registro errado: volta para "a registrar"
  public async undo(request: Request, response: Response): Promise<Response> {
    const setAttendance = container.resolve(SetAttendanceService);

    await setAttendance.execute({
      appointment_id: request.params.id,
      attendance: null,
      requester_id: request.user.id,
    });

    return response.status(204).send();
  }

  public async payment(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const setPayment = container.resolve(SetPaymentService);

    const appointment = await setPayment.execute({
      appointment_id: request.params.id,
      payment_method: request.body.payment_method,
      paid_cents: request.body.paid_cents,
    });

    return response.json({
      id: appointment.id,
      payment_method: appointment.payment_method,
      paid_cents: appointment.paid_cents,
    });
  }
}
