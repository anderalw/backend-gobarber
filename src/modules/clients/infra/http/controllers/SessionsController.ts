import { Request, Response } from 'express';
import { container } from 'tsyringe';
import AuthenticateClientService from '@modules/clients/services/AuthenticateClientService';

export default class SessionsController {
  public async create(request: Request, response: Response): Promise<Response> {
    const { email, password } = request.body;

    const authenticateClient = container.resolve(AuthenticateClientService);

    const { client, token } = await authenticateClient.execute({
      email,
      password,
    });

    // Remove a password do retorno por segurança
    const clientWithoutPassword = {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      created_at: client.created_at,
      updated_at: client.updated_at,
    };

    return response.json({ client: clientWithoutPassword, token });
  }
}
