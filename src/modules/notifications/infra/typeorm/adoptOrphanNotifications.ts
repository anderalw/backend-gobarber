import { container } from 'tsyringe';

import mongoDataSource from '@shared/infra/typeorm/mongoDataSource';
import ITenantsRepository from '@modules/tenants/repositories/ITenantsRepository';
import { ITenant } from '@shared/tenancy/TenantContext';
import Notification from './schemas/Notification';

// Notificações de antes das várias barbearias não têm tenant_id: vão para
// a barbearia padrão ou, sem ela, para a única que existir (a que a
// migration criou com os dados de antes)
export default async function adoptOrphanNotifications(
  preferred?: ITenant,
): Promise<void> {
  const repository = mongoDataSource.getMongoRepository(Notification);
  const orphans = { tenant_id: { $exists: false } };

  if ((await repository.count(orphans)) === 0) return;

  let tenant = preferred;

  if (!tenant) {
    const tenants = await container
      .resolve<ITenantsRepository>('TenantsRepository')
      .findAll();

    if (tenants.length === 1) [tenant] = tenants;
  }

  if (!tenant) return;

  await repository.updateMany(orphans, { $set: { tenant_id: tenant.id } });
}
