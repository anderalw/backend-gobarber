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
import NoShowPolicyService from '@modules/appointments/services/NoShowPolicyService';
import CreateAppointmentSeriesService from '@modules/appointments/services/CreateAppointmentSeriesService';
import CancelSeriesService from '@modules/appointments/services/CancelSeriesService';
import ConsentService from '@modules/clients/services/ConsentService';
import DepositService from '@modules/appointments/services/DepositService';

export default class AppointmentsController {
  public async deposit(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { payment_method, amount_cents } = request.body;

    return response.json(
      await container.resolve(DepositService).receive({
        appointment_id: request.params.id,
        payment_method,
        amount_cents,
        user_id: request.user.id,
      }),
    );
  }

  public async create(request: Request, response: Response): Promise<Response> {
    // O cliente vem sempre do token, nunca do body
    const client_id = request.user.id;
    const { provider_id, service_id, date } = request.body;

    await container.resolve(NoShowPolicyService).ensureCanBookOnline(client_id);
    await container.resolve(ConsentService).ensureAccepted(client_id);

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

    await container
      .resolve(NoShowPolicyService)
      .ensureCanBookOnline(request.user.id);
    await container.resolve(ConsentService).ensureAccepted(request.user.id);

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

  // Cliente fixo marcado pela agenda (dry_run: só a prévia dos horários)
  public async createSeries(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const {
      provider_id,
      service_id,
      client_id,
      date,
      interval_weeks,
      count,
      dry_run,
    } = request.body;

    const createSeries = container.resolve(CreateAppointmentSeriesService);

    const result = await createSeries.execute({
      requester_id: request.user.id,
      provider_id,
      service_id,
      client_id,
      date: new Date(date),
      interval_weeks,
      count,
      dry_run,
    });

    return response.json(result);
  }

  // Cancela o horário e os seguintes do mesmo cliente fixo
  public async cancelSeries(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const cancelSeries = container.resolve(CancelSeriesService);

    const canceled = await cancelSeries.execute({
      appointment_id: request.params.id,
      requester_id: request.user.id,
    });

    return response.json({ canceled: canceled.length });
  }

  // Próximos agendamentos do cliente logado
  public async mine(request: Request, response: Response): Promise<Response> {
    const listClientAppointments = container.resolve(
      ListClientAppointmentsService,
    );

    return response.json(await listClientAppointments.execute(request.user.id));
  }

  // Horários anteriores do cliente logado
  public async history(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const listClientAppointments = container.resolve(
      ListClientAppointmentsService,
    );

    return response.json(await listClientAppointments.history(request.user.id));
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
      payment_method: request.body.payment_method,
      paid_cents: request.body.paid_cents,
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
