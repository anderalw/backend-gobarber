import { Request, Response } from 'express';
import { container } from 'tsyringe';

import CreateServiceService from '@modules/catalog/services/CreateServiceService';
import UpdateServiceService from '@modules/catalog/services/UpdateServiceService';
import ListServicesService from '@modules/catalog/services/ListServicesService';
import ReorderServicesService from '@modules/catalog/services/ReorderServicesService';

export default class ServicesController {
  // Serviços ativos, para os clientes escolherem
  public async index(request: Request, response: Response): Promise<Response> {
    const listServices = container.resolve(ListServicesService);

    const services = await listServices.execute({ include_inactive: false });

    return response.json(services);
  }

  // Todos os serviços, inclusive desativados (painel do admin)
  public async all(request: Request, response: Response): Promise<Response> {
    const listServices = container.resolve(ListServicesService);

    const services = await listServices.execute({ include_inactive: true });

    return response.json(services);
  }

  // Nova ordem dos serviços
  public async reorder(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const services = await container
      .resolve(ReorderServicesService)
      .execute(request.body.ids);

    return response.json(services);
  }

  public async create(request: Request, response: Response): Promise<Response> {
    const { name, duration_minutes, price_cents, deposit_cents } = request.body;

    const createService = container.resolve(CreateServiceService);

    const service = await createService.execute({
      name,
      duration_minutes,
      price_cents,
      deposit_cents,
    });

    return response.status(201).json(service);
  }

  public async update(request: Request, response: Response): Promise<Response> {
    const { id } = request.params;
    const { name, duration_minutes, price_cents, deposit_cents, active } =
      request.body;

    const updateService = container.resolve(UpdateServiceService);

    const service = await updateService.execute({
      id,
      name,
      duration_minutes,
      price_cents,
      deposit_cents,
      active,
    });

    return response.json(service);
  }
}
