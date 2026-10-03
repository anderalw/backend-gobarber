import { injectable, inject } from 'tsyringe';

import tenancyConfig from '@config/tenancy';
import { runWithTenant } from '@shared/tenancy/TenantContext';
import EnsureFirstAdminService from '@modules/users/services/EnsureFirstAdminService';
import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';
import ITenantsRepository from '../repositories/ITenantsRepository';
import Tenant from '../infra/typeorm/entities/Tenant';
import ResolveTenantService from './ResolveTenantService';

interface IAdmin {
  name?: string;
  email?: string;
  password?: string;
}

// Instalação de uma barbearia só (e o ambiente de desenvolvimento): com
// DEFAULT_TENANT, garante que ela exista e que tenha o primeiro
// administrador (ADMIN_* do ambiente)
@injectable()
class PrepareDefaultTenantService {
  constructor(
    @inject('TenantsRepository')
    private tenantsRepository: ITenantsRepository,

    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,

    @inject(EnsureFirstAdminService)
    private ensureFirstAdmin: EnsureFirstAdminService,
  ) {}

  public async execute(
    admin: IAdmin,
  ): Promise<{ tenant: Tenant; admin: string | null } | null> {
    const slug = tenancyConfig.defaultTenant;

    if (!slug) return null;

    let tenant = await this.tenantsRepository.findBySlug(slug);

    if (!tenant) {
      const name = tenancyConfig.defaultTenantName || 'Barbearia';

      tenant = await this.tenantsRepository.create({ slug, name });

      await runWithTenant(tenant, () =>
        this.settingsRepository.set('shop_name', name),
      );

      ResolveTenantService.forget();
    }

    const created = await runWithTenant(tenant, () =>
      this.ensureFirstAdmin.execute(admin),
    );

    return { tenant, admin: created };
  }
}

export default PrepareDefaultTenantService;
