import { Request, Response, NextFunction } from 'express';
import redis from 'redis';
import AppError from '@shared/errors/AppError';
import { RateLimiterRedis } from 'rate-limiter-flexible';

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASS || undefined,
});

const Limiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ratelimit',
  // Por IP, por segundo. Abrir a agenda já faz várias requisições juntas
  // (dia, confirmações de amanhã, lista de espera, notificações), e numa
  // barbearia os computadores da rede saem pelo mesmo IP
  points: 30,
  duration: 1,
});

export default async function rateLimiter(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // request.ip só falta se a conexão já caiu; todos esses caem numa chave só
    await Limiter.consume(request.ip || 'desconhecido');

    return next();
  } catch {
    throw new AppError(
      'Muitas requisições, tente novamente em instantes.',
      429,
    );
  }
}
