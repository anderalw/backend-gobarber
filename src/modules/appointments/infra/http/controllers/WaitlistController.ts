import { Request, Response } from 'express';
import { container } from 'tsyringe';

import WaitlistService from '@modules/appointments/services/WaitlistService';

export default class WaitlistController {
  // Barbearia: quem está esperando no dia
  public async index(request: Request, response: Response): Promise<Response> {
    const waitlist = container.resolve(WaitlistService);

    return response.json(await waitlist.listByDate(String(request.query.date)));
  }

  // Barbearia colocando um cliente na lista
  public async create(request: Request, response: Response): Promise<Response> {
    const { client_id, date, provider_id, service_id, period, notes } =
      request.body;

    const waitlist = container.resolve(WaitlistService);

    const entry = await waitlist.add({
      client_id,
      date,
      provider_id,
      service_id,
      period,
      notes,
      created_by: 'provider',
      created_by_user: request.user.id,
    });

    return response.status(201).json({ id: entry.id });
  }

  // Cliente: os dias em que está esperando
  public async mine(request: Request, response: Response): Promise<Response> {
    const waitlist = container.resolve(WaitlistService);

    const entries = await waitlist.listForClient(request.user.id);

    return response.json(
      entries.map(entry => ({
        id: entry.id,
        date: entry.date,
        period: entry.period,
        provider: entry.provider
          ? { id: entry.provider.id, name: entry.provider.name }
          : null,
        service: entry.service
          ? { id: entry.service.id, name: entry.service.name }
          : null,
      })),
    );
  }

  // Cliente entrando na lista de um dia lotado
  public async join(request: Request, response: Response): Promise<Response> {
    const { date, provider_id, service_id, period } = request.body;

    const waitlist = container.resolve(WaitlistService);

    const entry = await waitlist.add({
      client_id: request.user.id,
      date,
      provider_id,
      service_id,
      period,
      created_by: 'client',
    });

    return response.status(201).json({ id: entry.id });
  }

  public async delete(request: Request, response: Response): Promise<Response> {
    const waitlist = container.resolve(WaitlistService);

    await waitlist.remove(request.params.id, request.user);

    return response.status(204).send();
  }
}
