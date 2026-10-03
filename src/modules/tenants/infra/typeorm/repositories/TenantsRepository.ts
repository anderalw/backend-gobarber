import { In, Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';

import ITenantsRepository, {
  ICreateTenantDTO,
} from '@modules/tenants/repositories/ITenantsRepository';
import Tenant from '../entities/Tenant';

// A lista de barbearias não tem isolamento: é da plataforma
class TenantsRepository implements ITenantsRepository {
  private ormRepository: Repository<Tenant>;

  constructor() {
    this.ormRepository = dataSource.getRepository(Tenant);
  }

  public async findById(id: string): Promise<Tenant | undefined> {
    if (!id) return undefined;

    return (await this.ormRepository.findOneBy({ id })) ?? undefined;
  }

  public async findBySlug(slug: string): Promise<Tenant | undefined> {
    if (!slug) return undefined;

    return (await this.ormRepository.findOneBy({ slug })) ?? undefined;
  }

  public async findByDomain(domains: string[]): Promise<Tenant | undefined> {
    if (domains.length === 0) return undefined;

    return (
      (await this.ormRepository.findOneBy({ custom_domain: In(domains) })) ??
      undefined
    );
  }

  public async findAll(): Promise<Tenant[]> {
    return this.ormRepository.find({ order: { created_at: 'ASC' } });
  }

  public async findActive(): Promise<Tenant[]> {
    return this.ormRepository.find({
      where: { status: 'active' },
      order: { created_at: 'ASC' },
    });
  }

  public async create(data: ICreateTenantDTO): Promise<Tenant> {
    const tenant = this.ormRepository.create(data);

    return this.ormRepository.save(tenant);
  }

  public async save(tenant: Tenant): Promise<Tenant> {
    return this.ormRepository.save(tenant);
  }

  public async remove(tenant: Tenant): Promise<void> {
    await this.ormRepository.remove(tenant);
  }
}

export default TenantsRepository;
