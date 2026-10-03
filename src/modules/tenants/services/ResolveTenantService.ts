import { injectable, inject } from 'tsyringe';

import tenancyConfig from '@config/tenancy';
import { matchHost } from '@shared/tenancy/hosts';
import ITenantsRepository from '../repositories/ITenantsRepository';
import Tenant from '../infra/typeorm/entities/Tenant';

// Quanto tempo a resposta de um endereço fica guardada (toda requisição
// passa por aqui)
const CACHE_MS = 30 * 1000;

const cache = new Map<string, { tenant: Tenant | null; until: number }>();

// Descobre a barbearia pelo endereço acessado
@injectable()
class ResolveTenantService {
  constructor(
    @inject('TenantsRepository')
    private tenantsRepository: ITenantsRepository,
  ) {}

  // Depois de criar, alterar ou excluir uma barbearia
  public static forget(): void {
    cache.clear();
  }

  public async execute(host: string | undefined): Promise<Tenant | null> {
    const key = host || '';
    const cached = cache.get(key);

    if (cached && cached.until > Date.now()) return cached.tenant;

    const tenant = (await this.lookup(host)) ?? null;

    cache.set(key, { tenant, until: Date.now() + CACHE_MS });

    return tenant;
  }

  private async lookup(host: string | undefined): Promise<Tenant | undefined> {
    const match = matchHost(host);

    switch (match.kind) {
      case 'default':
        return this.tenantsRepository.findBySlug(tenancyConfig.defaultTenant);
      case 'slug':
        return this.tenantsRepository.findBySlug(match.slug);
      case 'domain':
        return this.tenantsRepository.findByDomain(match.domains);
      default:
        return undefined;
    }
  }
}

export default ResolveTenantService;
