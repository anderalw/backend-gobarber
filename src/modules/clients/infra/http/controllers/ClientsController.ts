import { Request, Response } from 'express';
import { container } from 'tsyringe';
import CreateClientService from '@modules/clients/services/CreateClientService';
import SearchClientsService from '@modules/clients/services/SearchClientsService';
import CreateClientByProviderService from '@modules/clients/services/CreateClientByProviderService';

export default class ClientsController {
  // Cadastro rápido pelo barbeiro, na hora de marcar pela agenda
  public async createByProvider(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { name, phone, email } = request.body;

    const createClient = container.resolve(CreateClientByProviderService);

    const client = await createClient.execute({ name, phone, email });

    return response.json({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
    });
  }

  // Barbeiro buscando um cliente para marcar pela agenda
  public async index(request: Request, response: Response): Promise<Response> {
    const searchClients = container.resolve(SearchClientsService);

    const clients = await searchClients.execute(String(request.query.search));

    return response.json(
      clients.map(({ id, name, email, phone }) => ({ id, name, email, phone })),
    );
  }

  public async create(request: Request, response: Response): Promise<Response> {
    const { name, email, password, phone } = request.body;

    const createClient = container.resolve(CreateClientService);

    const client = await createClient.execute({
      name,
      email,
      password,
      phone,
    });

    // Removemos a password do retorno por segurança
    const clientWithoutPassword = {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      created_at: client.created_at,
      updated_at: client.updated_at,
    };

    return response.json(clientWithoutPassword);
  }
}
