import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

import AppError from '@shared/errors/AppError';

// Rotas internas (usadas pelo painel do SaaS): só com o PLATFORM_TOKEN do
// ambiente (antes METRICS_TOKEN). Sem ele, as rotas nem existem (404)
export default function ensureMetricsToken(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const expected = process.env.PLATFORM_TOKEN || process.env.METRICS_TOKEN;

  if (!expected) {
    throw new AppError('Não encontrado.', 404);
  }

  const [scheme, token] = (request.headers.authorization || '').split(' ');
  const given = Buffer.from(scheme === 'Bearer' && token ? token : '');
  const wanted = Buffer.from(expected);

  // Comparação em tempo constante: não revela o token aos poucos
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    throw new AppError('Acesso negado.', 401);
  }

  next();
}
