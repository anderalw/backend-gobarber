import { Request, Response, NextFunction } from 'express';

import AppError from '@shared/errors/AppError';

type Role = 'provider' | 'client';

// Deve ser usado depois do ensureAuthenticated, que preenche request.user.role
export default function ensureRole(...roles: Role[]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!roles.includes(request.user.role)) {
      throw new AppError('Acesso negado para este tipo de conta.', 403);
    }

    return next();
  };
}
