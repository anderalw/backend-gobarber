import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import User from '@modules/users/infra/typeorm/entities/User';
import { Permission } from '@modules/users/permissions';

const DENIED =
  'Você não tem permissão para esta ação. Fale com o administrador.';

// Usuário da equipe que fez o pedido, com o perfil (uma consulta por
// requisição). Deve vir depois do ensureAuthenticated
export async function staffOf(request: Request): Promise<User> {
  if (request.staff) return request.staff;

  const { id, role } = request.user;

  // Token de cliente nunca é da equipe, mesmo que o id coincida. Sem id o
  // TypeORM 0.3 ignoraria o filtro e traria o primeiro usuário
  const user =
    role === 'provider' && id
      ? await container
          .resolve<IUsersRepository>('UsersRepository')
          .findById(id)
      : undefined;

  if (!user || !user.active) throw new AppError(DENIED, 403);

  request.staff = user;

  return user;
}

// Pede uma das permissões (o administrador tem todas)
export default function ensurePermission(...permissions: Permission[]) {
  return async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    const user = await staffOf(request);

    if (!permissions.some(permission => user.can(permission))) {
      throw new AppError(DENIED, 403);
    }

    next();
  };
}

// Mexer na agenda de um barbeiro: a própria sempre; a dos outros, com a
// permissão de marcar para qualquer barbeiro
export async function ensureAgendaOf(
  request: Request,
  provider_id: string | null | undefined,
): Promise<void> {
  // Cliente: as regras dele ficam nos próprios serviços
  if (request.user.role !== 'provider') return;

  const user = await staffOf(request);

  if (provider_id !== user.id && !user.can('agenda.manage')) {
    throw new AppError(
      'Você só pode mexer nos seus próprios agendamentos. Fale com o administrador.',
      403,
    );
  }
}
