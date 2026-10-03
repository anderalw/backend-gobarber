import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';

import AppError from '@shared/errors/AppError';

import authConfig from '@config/auth';
import { currentTenant } from '@shared/tenancy/TenantContext';

interface ITokenPayLoad {
  iat: number;
  exp: number;
  sub: string;
  role?: 'provider' | 'client';
  // Barbearia em que o login foi feito
  tid?: string;
}

export default function ensureAuthenticated(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new AppError('Sessão não encontrada, faça login novamente.', 401);
  }

  const [, token] = authHeader.split(' ');

  let payload: ITokenPayLoad;

  try {
    payload = verify(token, authConfig.jwt.secret, {
      algorithms: [authConfig.jwt.algorithm],
    }) as ITokenPayLoad;
  } catch {
    throw new AppError(
      'Sessão inválida ou expirada, faça login novamente.',
      401,
    );
  }

  const { sub, role, tid } = payload;

  // Tokens emitidos antes da separação cliente/barbeiro não têm role:
  // são recusados para obrigar um novo login
  if (role !== 'provider' && role !== 'client') {
    throw new AppError(
      'Sessão inválida ou expirada, faça login novamente.',
      401,
    );
  }

  // Token de outra barbearia (ou de antes das várias barbearias): o
  // usuário não existe aqui
  if (tid !== currentTenant()?.id) {
    throw new AppError(
      'Sessão inválida ou expirada, faça login novamente.',
      401,
    );
  }

  request.user = {
    id: sub,
    role,
  };

  return next();
}
