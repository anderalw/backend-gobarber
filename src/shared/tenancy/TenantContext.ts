import { AsyncLocalStorage, AsyncResource } from 'async_hooks';
import { RequestHandler } from 'express';

import AppError from '@shared/errors/AppError';

// O que o resto do sistema precisa saber da barbearia da requisição
export interface ITenant {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  status: 'active' | 'suspended';
  // Ramo de negócio (vocabulário e padrões)
  segment?: string;
}

interface IContext {
  tenant?: ITenant;
  // Operação da plataforma (painel, tarefas): enxerga todas as barbearias
  platform?: boolean;
}

const storage = new AsyncLocalStorage<IContext>();

// Roda a função "dentro" de uma barbearia: as consultas ao banco, o cache e
// os links passam a ser dela (o banco só devolve as linhas dela)
export function runWithTenant<T>(tenant: ITenant, fn: () => T): T {
  return storage.run({ tenant }, fn);
}

// Roda como plataforma, fora de qualquer barbearia
export function runAsPlatform<T>(fn: () => T): T {
  return storage.run({ platform: true }, fn);
}

export function currentTenant(): ITenant | undefined {
  return storage.getStore()?.tenant;
}

export function isPlatform(): boolean {
  return storage.getStore()?.platform === true;
}

// Para o que só faz sentido dentro de uma barbearia
export function requireTenant(): ITenant {
  const tenant = currentTenant();

  if (!tenant) {
    throw new AppError('Negócio não identificado.', 400);
  }

  return tenant;
}

// Barbearia que vai dentro do token de login: o token de uma barbearia não
// vale em outra
export function tenantClaim(): { tid?: string } {
  const tenant = currentTenant();

  return tenant ? { tid: tenant.id } : {};
}

// Middlewares que chamam o next() a partir de eventos do stream (ex.: o
// multer) perdem a barbearia no caminho; este embrulho devolve
export function keepTenant(middleware: RequestHandler): RequestHandler {
  return (request, response, next) =>
    middleware(request, response, AsyncResource.bind(next));
}
