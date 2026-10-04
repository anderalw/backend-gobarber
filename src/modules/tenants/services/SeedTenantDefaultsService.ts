import { injectable, inject } from 'tsyringe';

import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';
import IBlockReasonsRepository from '@modules/appointments/repositories/IBlockReasonsRepository';
import IRolesRepository from '@modules/users/repositories/IRolesRepository';
import { DEFAULT_ROLES } from '@modules/users/permissions';
import { segmentOf } from '../segments';

// Motivos de bloqueio que toda barbearia começa tendo (antes vinham da
// migration, quando cada instalação era de uma barbearia só)
export const DEFAULT_BLOCK_REASONS = ['Almoço', 'Consulta', 'Folga', 'Férias'];

// O começo de uma barbearia nova: o nome no site, os perfis de acesso e os
// cadastros padrão.
// Roda dentro da barbearia (runWithTenant)
@injectable()
class SeedTenantDefaultsService {
  constructor(
    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,

    @inject('BlockReasonsRepository')
    private blockReasonsRepository: IBlockReasonsRepository,

    @inject('RolesRepository')
    private rolesRepository: IRolesRepository,
  ) {}

  public async execute(name: string, segmentKey?: string): Promise<void> {
    const segment = segmentOf(segmentKey);

    await this.settingsRepository.set('shop_name', name);
    await this.seedRoles(segment.vocabulary.professional);

    const reasons = await this.blockReasonsRepository.findAll();

    if (reasons.length === 0) {
      await segment.block_reasons.reduce(
        (previous, reason) =>
          previous.then(() => this.blockReasonsRepository.create(reason)),
        Promise.resolve() as Promise<unknown>,
      );
    }
  }

  // Perfis de acesso: Administrador, Recepção e o do profissional (com o
  // nome do segmento: Barbeiro, Tatuador...)
  public async seedRoles(professional = 'Barbeiro'): Promise<void> {
    if ((await this.rolesRepository.findAll()).length > 0) return;

    await DEFAULT_ROLES.reduce(
      (previous, role) =>
        previous.then(() =>
          this.rolesRepository.create(
            role.system_key === 'barber'
              ? { ...role, name: professional }
              : role,
          ),
        ),
      Promise.resolve() as Promise<unknown>,
    );
  }
}

export default SeedTenantDefaultsService;
