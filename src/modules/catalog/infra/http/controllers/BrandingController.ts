import { Request, Response } from 'express';
import { container } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import BrandingService from '@modules/catalog/services/BrandingService';
import VocabularyService from '@modules/catalog/services/VocabularyService';
import FeaturesService from '@modules/catalog/services/FeaturesService';

export default class BrandingController {
  // Identidade e vocabulário: as telas carregam juntos ao abrir
  public async show(request: Request, response: Response): Promise<Response> {
    const [branding, vocabulary, features] = await Promise.all([
      container.resolve(BrandingService).get(),
      container.resolve(VocabularyService).get(),
      container.resolve(FeaturesService).get(),
    ]);

    return response.json({ ...branding, ...vocabulary, ...features });
  }

  public async updateFeatures(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(
      await container.resolve(FeaturesService).update(request.body),
    );
  }

  public async update(request: Request, response: Response): Promise<Response> {
    const { name, primary_color } = request.body;

    return response.json(
      await container.resolve(BrandingService).update({ name, primary_color }),
    );
  }

  public async updateLogo(
    request: Request,
    response: Response,
  ): Promise<Response> {
    if (!request.file) {
      throw new AppError('Envie a imagem do logo.');
    }

    return response.json(
      await container
        .resolve(BrandingService)
        .updateLogo(request.file.filename),
    );
  }

  public async removeLogo(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(await container.resolve(BrandingService).removeLogo());
  }
}
