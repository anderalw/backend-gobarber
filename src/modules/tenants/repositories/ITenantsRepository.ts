import Tenant from '../infra/typeorm/entities/Tenant';

export interface ICreateTenantDTO {
  slug: string;
  name: string;
  custom_domain?: string | null;
  segment?: string;
}

export default interface ITenantsRepository {
  findById(id: string): Promise<Tenant | undefined>;
  findBySlug(slug: string): Promise<Tenant | undefined>;
  findByDomain(domains: string[]): Promise<Tenant | undefined>;
  findAll(): Promise<Tenant[]>;
  findActive(): Promise<Tenant[]>;
  create(data: ICreateTenantDTO): Promise<Tenant>;
  save(tenant: Tenant): Promise<Tenant>;
  remove(tenant: Tenant): Promise<void>;
}
