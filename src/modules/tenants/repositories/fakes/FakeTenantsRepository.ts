import { randomUUID } from 'crypto';

import ITenantsRepository, { ICreateTenantDTO } from '../ITenantsRepository';
import Tenant from '../../infra/typeorm/entities/Tenant';

class FakeTenantsRepository implements ITenantsRepository {
  private tenants: Tenant[] = [];

  public async findById(id: string): Promise<Tenant | undefined> {
    return this.tenants.find(tenant => tenant.id === id);
  }

  public async findBySlug(slug: string): Promise<Tenant | undefined> {
    return this.tenants.find(tenant => tenant.slug === slug);
  }

  public async findByDomain(domains: string[]): Promise<Tenant | undefined> {
    return this.tenants.find(
      tenant =>
        !!tenant.custom_domain && domains.includes(tenant.custom_domain),
    );
  }

  public async findAll(): Promise<Tenant[]> {
    return [...this.tenants];
  }

  public async findActive(): Promise<Tenant[]> {
    return this.tenants.filter(tenant => tenant.status === 'active');
  }

  public async create(data: ICreateTenantDTO): Promise<Tenant> {
    const tenant = Object.assign(new Tenant(), {
      id: randomUUID(),
      custom_domain: null,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
      ...data,
    });

    this.tenants.push(tenant);

    return tenant;
  }

  public async save(tenant: Tenant): Promise<Tenant> {
    const index = this.tenants.findIndex(item => item.id === tenant.id);

    this.tenants[index] = tenant;

    return tenant;
  }

  public async remove(tenant: Tenant): Promise<void> {
    this.tenants = this.tenants.filter(item => item.id !== tenant.id);
  }
}

export default FakeTenantsRepository;
