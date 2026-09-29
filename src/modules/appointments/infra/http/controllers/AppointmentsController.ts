import { Response, Request } from 'express';
import { container } from 'tsyringe';

import CreateAppointmentsService from '@modules/appointments/services/CreateAppointmentsService';
import CreateProviderAppointmentService from '@modules/appointments/services/CreateProviderAppointmentService';
import CreateAnyProviderAppointmentService from '@modules/appointments/services/CreateAnyProviderAppointmentService';
import CancelAppointmentService from '@modules/appointments/services/CancelAppointmentService';
import RescheduleAppointmentService from '@modules/appointments/services/RescheduleAppointmentService';
import SetConfirmationService from '@modules/appointments/services/SetConfirmationService';
import SetAttendanceService from '@modules/appointments/services/SetAttendanceService';
import ListClientAppointmentsService from '@modules/appointments/services/ListClientAppointmentsService';

export default class AppointmentsController {
  public async create(request: Request, response: Response): Promise<Response> {
    // O cliente vem sempre do token, nunca do body
    const client_id = request.user.id;
    const { provider_id, service_id, date } = request.body;

    const createAppointmets = container.resolve(CreateAppointmentsService);

    const appointment = await createAppointmets.execute({
      date,
      provider_id,
      client_id,
      service_id,
    });

    return response.json(appointment);
  }

  // Cliente sem preferência de barbeiro
  public async createWithAnyProvider(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { service_id, date } = request.body;

    const createAppointment = container.resolve(
      CreateAnyProviderAppointmentService,
    );

    const appointment = await createAppointment.execute({
      client_id: request.user.id,
      service_id,
      date: new Date(date),
    });

    return response.json(appointment);
  }

  // Barbeiro marcando direto na agenda
  public async createByProvider(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { provider_id, service_id, date, client_id } = request.body;

    const createAppointment = container.resolve(
      CreateProviderAppointmentService,
    );

    const appointment = await createAppointment.execute({
      requester_id: request.user.id,
      provider_id,
      service_id,
      date,
      client_id,
    });

    return response.json(appointment);
  }

  // Próximos agendamentos do cliente logado
  public async mine(request: Request, response: Response): Promise<Response> {
    const listClientAppointments = container.resolve(
      ListClientAppointmentsService,
    );

    return response.json(await listClientAppointments.execute(request.user.id));
  }

  public async attendance(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const setAttendance = container.resolve(SetAttendanceService);

    const appointment = await setAttendance.execute({
      appointment_id: request.params.id,
      attendance: request.body.attendance,
      requester_id: request.user.id,
    });

    return response.json(appointment);
  }

  public async confirmation(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const setConfirmation = container.resolve(SetConfirmationService);

    const appointment = await setConfirmation.execute({
      appointment_id: request.params.id,
      confirmed: request.body.confirmed,
      requester_id: request.user.id,
    });

    return response.json(appointment);
  }

  public async cancel(request: Request, response: Response): Promise<Response> {
    const cancelAppointment = container.resolve(CancelAppointmentService);

    await cancelAppointment.execute({
      appointment_id: request.params.id,
      requester: request.user,
    });

    return response.status(204).send();
  }

  public async reschedule(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { provider_id, date } = request.body;

    const rescheduleAppointment = container.resolve(
      RescheduleAppointmentService,
    );

    await rescheduleAppointment.execute({
      appointment_id: request.params.id,
      requester: request.user,
      provider_id,
      date,
    });

    return response.status(204).send();
  }
}
