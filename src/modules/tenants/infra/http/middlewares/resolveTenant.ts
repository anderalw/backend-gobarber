import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';

import { runWithTenant } from '@shared/tenancy/TenantContext';
import ResolveTenantService from '@modules/tenants/services/ResolveTenantService';

// Endereço que o visitante abriu. O site manda no X-Tenant-Host (no
// computador o site e a API ficam em portas diferentes); sem ele, vale o
// endereço da própria requisição (atrás do proxy, o X-Forwarded-Host)
function requestedHost(request: Request): string {
  const header = request.headers['x-tenant-host'];

  return (Array.isArray(header) ? header[0] : header) || request.hostname;
}

// Descobre a barbearia pelo endereço e roda o resto da requisição dentro
// dela (banco, cache e links passam a ser só dela)
export default async function resolveTenant(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const tenant = await container
    .resolve(ResolveTenantService)
    .execute(requestedHost(request));

  if (!tenant) {
    response.status(404).json({
      status: 'error',
      code: 'TENANT_NOT_FOUND',
      message: 'Barbearia não encontrada neste endereço.',
    });
    return;
  }

  if (tenant.status !== 'active') {
    response.status(403).json({
      status: 'error',
      code: 'TENANT_SUSPENDED',
      message: 'Sistema temporariamente indisponível.',
    });
    return;
  }

  runWithTenant(tenant, () => next());
}
