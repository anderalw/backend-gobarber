import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import tenancyConfig from '@config/tenancy';
import {
  DOMAIN_PATTERN,
  RESERVED_SLUGS,
  SLUG_PATTERN,
  normalizeHost,
} from '@shared/tenancy/hosts';
import { runWithTenant } from '@shared/tenancy/TenantContext';
import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';
import EnsureFirstAdminService from '@modules/users/services/EnsureFirstAdminService';
import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import ITenantsRepository from '../repositories/ITenantsRepository';
import Tenant, { TenantStatus } from '../infra/typeorm/entities/Tenant';
import ResolveTenantService from './ResolveTenantService';

interface ICreate {
  slug: string;
  name: string;
  custom_domain?: string | null;
  admin: { name?: string; email: string; password: string };
}

interface IUpdate {
  name?: string;
  custom_domain?: string | null;
  status?: TenantStatus;
}

// Cadastro das barbearias (usado pelo painel do SaaS)
@injectable()
class TenantsService {
  constructor(
    @inject('TenantsRepository')
    private tenantsRepository: ITenantsRepository,

    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,

    @inject('NotificationsRepository')
    private notificationsRepository: INotificationsRepository,

    @inject(EnsureFirstAdminService)
    private ensureFirstAdmin: EnsureFirstAdminService,
  ) {}

  public async list(): Promise<Tenant[]> {
    return this.tenantsRepository.findAll();
  }

  public async show(id: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findById(id);

    if (!tenant) throw new AppError('Barbearia não encontrada.', 404);

    return tenant;
  }

  // Cria a barbearia já com o nome no site e o primeiro administrador
  public async create({
    slug,
    name,
    custom_domain,
    admin,
  }: ICreate): Promise<Tenant> {
    const cleanSlug = await this.validSlug(slug);
    const domain = await this.validDomain(custom_domain);

    if (admin.password.length < 8) {
      throw new AppError('A senha do administrador precisa de 8 caracteres.');
    }

    const tenant = await this.tenantsRepository.create({
      slug: cleanSlug,
      name: name.trim(),
      custom_domain: domain,
    });

    try {
      await runWithTenant(tenant, async () => {
        await this.settingsRepository.set('shop_name', tenant.name);
        await this.ensureFirstAdmin.execute(admin);
      });
    } catch (err) {
      // Sem o administrador, ninguém conseguiria entrar: desfaz
      await this.tenantsRepository.remove(tenant);
      throw err;
    }

    ResolveTenantService.forget();

    return tenant;
  }

  public async update(id: string, data: IUpdate): Promise<Tenant> {
    const tenant = await this.show(id);

    if (data.name !== undefined) tenant.name = data.name.trim();

    if (data.custom_domain !== undefined) {
      tenant.custom_domain = await this.validDomain(data.custom_domain, id);
    }

    if (data.status !== undefined) tenant.status = data.status;

    await this.tenantsRepository.save(tenant);

    ResolveTenantService.forget();

    return tenant;
  }

  // Apaga a barbearia e todos os dados dela (o banco remove em cascata)
  public async remove(id: string): Promise<void> {
    const tenant = await this.show(id);

    await runWithTenant(tenant, () => this.notificationsRepository.removeAll());
    await runWithTenant(tenant, () => this.tenantsRepository.remove(tenant));

    ResolveTenantService.forget();
  }

  private async validSlug(slug: string): Promise<string> {
    const value = slug.trim().toLowerCase();

    if (!SLUG_PATTERN.test(value) || RESERVED_SLUGS.includes(value)) {
      throw new AppError(
        'Identificador inválido: use letras minúsculas, números e hífen.',
      );
    }

    if (await this.tenantsRepository.findBySlug(value)) {
      throw new AppError('Já existe uma barbearia com esse identificador.');
    }

    return value;
  }

  private async validDomain(
    domain: string | null | undefined,
    except?: string,
  ): Promise<string | null> {
    if (!domain) return null;

    // Aceita colado do navegador: "https://www.dominio.com.br/"
    const value = normalizeHost(
      domain.replace(/^https?:\/\//i, '').split('/')[0],
    );

    if (!DOMAIN_PATTERN.test(value)) {
      throw new AppError('Domínio inválido.');
    }

    const base = tenancyConfig.baseDomain;

    if (value === base || value.endsWith(`.${base}`)) {
      throw new AppError(
        'Esse endereço já é do Pontual: o domínio próprio é outro.',
      );
    }

    const bare = value.startsWith('www.') ? value.slice(4) : value;
    const owner = await this.tenantsRepository.findByDomain([
      bare,
      `www.${bare}`,
    ]);

    if (owner && owner.id !== except) {
      throw new AppError('Esse domínio já está em outra barbearia.');
    }

    return value;
  }
}

export default TenantsService;
