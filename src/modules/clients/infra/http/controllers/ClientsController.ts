import { Request, Response } from 'express';
import { container } from 'tsyringe';
import CreateClientService from '@modules/clients/services/CreateClientService';

export default class ClientsController {
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
