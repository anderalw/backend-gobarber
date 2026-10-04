import { Request, Response } from 'express';
import { container } from 'tsyringe';

import ConsentService from '@modules/clients/services/ConsentService';

export default class ConsentController {
  // Cliente: o termo e se já aceitou
  public async mine(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container.resolve(ConsentService).status(request.user.id),
    );
  }

  public async acceptMine(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(
      await container
        .resolve(ConsentService)
        .accept(request.user.id, request.body.version),
    );
  }

  // Barbearia: situação do cliente e aceite registrado na recepção
  public async show(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container.resolve(ConsentService).status(request.params.id),
    );
  }

  public async accept(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container
        .resolve(ConsentService)
        .accept(request.params.id, request.body.version, request.user.id),
    );
  }

  // Configurações: o texto do termo
  public async term(request: Request, response: Response): Promise<Response> {
    return response.json(await container.resolve(ConsentService).term());
  }

  public async update(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container.resolve(ConsentService).update(request.body.text),
    );
  }
}
