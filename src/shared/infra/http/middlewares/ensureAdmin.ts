import { Request, Response, NextFunction } from 'express';
import User from '@modules/users/infra/typeorm/entities/User';
import AppError from '@shared/errors/AppError';
import dataSource from '@shared/infra/typeorm/dataSource';

export default async function ensureAdmin(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  // O request.user.id é injetado pelo middleware ensureAuthenticated
  const { id: user_id, role } = request.user;

  // Um token de cliente nunca é de administrador, mesmo que o id coincida
  // Sem id o TypeORM 0.3 ignoraria o filtro e traria o primeiro usuário
  if (role !== 'provider' || !user_id) {
    throw new AppError(
      'Acesso negado. Apenas administradores podem realizar esta ação.',
      403,
    );
  }

  const user = await dataSource.getRepository(User).findOneBy({ id: user_id });

  // Verifica se o usuário existe e se é administrador
  if (!user || !user.is_admin) {
    throw new AppError(
      'Acesso negado. Apenas administradores podem realizar esta ação.',
      403,
    );
  }

  return next();
}
