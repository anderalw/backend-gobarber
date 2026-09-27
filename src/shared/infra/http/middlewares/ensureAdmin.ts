import { Request, Response, NextFunction } from 'express';
import { getRepository } from 'typeorm';

import User from '@modules/users/infra/typeorm/entities/User';
import AppError from '@shared/errors/AppError';

export default async function ensureAdmin(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  // O request.user.id é injetado pelo middleware ensureAuthenticated
  const user_id = request.user.id;

  const usersRepository = getRepository(User);
  const user = await usersRepository.findOne(user_id);

  // Verifica se o utilizador existe e se é administrador
  if (!user || !user.is_admin) {
    throw new AppError('Acesso negado. Apenas administradores podem realizar esta ação.', 403);
  }

  return next();
}