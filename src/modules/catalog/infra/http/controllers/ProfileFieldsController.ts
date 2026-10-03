import { Request, Response } from 'express';
import { container } from 'tsyringe';

import ProfileFieldsService from '@modules/catalog/services/ProfileFieldsService';

// Quais campos aparecem nos cadastros e quais são obrigatórios
export default class ProfileFieldsController {
  public async show(request: Request, response: Response): Promise<Response> {
    return response.json(await container.resolve(ProfileFieldsService).get());
  }

  public async update(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container.resolve(ProfileFieldsService).update(request.body),
    );
  }
}
