import { Request, Response } from 'express';
import { container } from 'tsyringe';
import AuthenticateClientService from '@modules/clients/services/AuthenticateClientService';
import AuthenticateClientWithGoogleService from '@modules/clients/services/AuthenticateClientWithGoogleService';
import IGoogleTokenProvider from '@modules/clients/providers/GoogleTokenProvider/models/IGoogleTokenProvider';
import Client from '@modules/clients/infra/typeorm/entities/Client';

// Os dados do cliente devolvidos ao entrar (sem senha nem ids externos)
function publicClient(client: Client) {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    created_at: client.created_at,
    updated_at: client.updated_at,
  };
}

export default class SessionsController {
  public async create(request: Request, response: Response): Promise<Response> {
    const { email, password } = request.body;

    const authenticateClient = container.resolve(AuthenticateClientService);

    const { client, token } = await authenticateClient.execute({
      email,
      password,
    });

    return response.json({ client: publicClient(client), token });
  }

  // "Continuar com o Google": credential é o token do botão do Google
  public async google(request: Request, response: Response): Promise<Response> {
    const authenticate = container.resolve(AuthenticateClientWithGoogleService);

    const { client, token, created } = await authenticate.execute(
      request.body.credential,
    );

    return response.json({ client: publicClient(client), token, created });
  }

  // O site mostra o botão do Google só se ele estiver configurado
  public async googleConfig(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const provider = container.resolve<IGoogleTokenProvider>(
      'GoogleTokenProvider',
    );

    return response.json({ client_id: provider.clientId() });
  }
}
