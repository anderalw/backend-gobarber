import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import FeaturesService from '@modules/catalog/services/FeaturesService';
import { FeatureKey } from '@modules/tenants/segments';

// Rotas de um recurso que o negócio desligou não respondem
export default function ensureFeature(key: FeatureKey) {
  return async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!(await container.resolve(FeaturesService).isOn(key))) {
      throw new AppError('Este recurso está desligado neste negócio.', 403);
    }

    next();
  };
}
