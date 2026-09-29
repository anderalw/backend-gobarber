import { Request, Response } from 'express';
import { container } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import SiteService from '@modules/catalog/services/SiteService';

export default class SiteController {
  // Público: a página inicial da barbearia
  public async show(request: Request, response: Response): Promise<Response> {
    return response.json(await container.resolve(SiteService).getSite());
  }

  public async update(request: Request, response: Response): Promise<Response> {
    const { tagline, about, address, whatsapp, instagram } = request.body;

    return response.json(
      await container
        .resolve(SiteService)
        .updateContent({ tagline, about, address, whatsapp, instagram }),
    );
  }

  public async updateCover(
    request: Request,
    response: Response,
  ): Promise<Response> {
    if (!request.file) {
      throw new AppError('Envie a foto da capa.');
    }

    return response.json(
      await container.resolve(SiteService).updateCover(request.file.filename),
    );
  }

  public async removeCover(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(await container.resolve(SiteService).removeCover());
  }
}
