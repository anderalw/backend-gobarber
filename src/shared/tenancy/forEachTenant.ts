import { container } from 'tsyringe';

import ITenantsRepository from '@modules/tenants/repositories/ITenantsRepository';
import { runWithTenant, ITenant } from './TenantContext';

// Roda a tarefa em cada barbearia ativa, uma de cada vez. A falha de uma
// não impede as outras
export default async function forEachTenant(
  label: string,
  task: (tenant: ITenant) => Promise<unknown>,
): Promise<void> {
  const tenants = await container
    .resolve<ITenantsRepository>('TenantsRepository')
    .findActive();

  // eslint-disable-next-line no-restricted-syntax
  for (const tenant of tenants) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await runWithTenant(tenant, () => task(tenant));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`${label} (${tenant.slug}):`, err);
    }
  }
}
