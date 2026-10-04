import { injectable, inject } from 'tsyringe';

import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';
import IBlockReasonsRepository from '@modules/appointments/repositories/IBlockReasonsRepository';
import IRolesRepository from '@modules/users/repositories/IRolesRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
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

    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,
  ) {}

  public async execute(name: string, segmentKey?: string): Promise<void> {
    const segment = segmentOf(segmentKey);

    await this.settingsRepository.set('shop_name', name);

    // Intervalo e campos do cadastro do ramo (só se ainda não há nada)
    if (
      segment.defaults.buffer_minutes > 0 &&
      !(await this.settingsRepository.get('appointment_buffer_minutes'))
    ) {
      await this.settingsRepository.set(
        'appointment_buffer_minutes',
        String(segment.defaults.buffer_minutes),
      );
    }

    if (
      segment.defaults.profile_fields &&
      !(await this.settingsRepository.get('profile_fields'))
    ) {
      await this.settingsRepository.set(
        'profile_fields',
        JSON.stringify(segment.defaults.profile_fields),
      );
    }
    await this.seedRoles(segment.vocabulary.professional);
    await this.seedServices(segment.sample_services);

    // Texto "sobre" do site (o admin reescreve em Configurações → Site)
    if (!(await this.settingsRepository.get('site_about'))) {
      await this.settingsRepository.set('site_about', segment.about);
    }

    const reasons = await this.blockReasonsRepository.findAll();

    if (reasons.length === 0) {
      await segment.block_reasons.reduce(
        (previous, reason) =>
          previous.then(() => this.blockReasonsRepository.create(reason)),
        Promise.resolve() as Promise<unknown>,
      );
    }
  }

  // Serviços de exemplo do ramo, só num negócio sem serviços
  private async seedServices(
    samples: Array<{
      name: string;
      duration_minutes: number;
      price_cents: number;
      deposit_cents?: number;
    }>,
  ): Promise<void> {
    const existing = await this.servicesRepository.findAll({
      only_active: false,
    });

    if (existing.length > 0) return;

    await samples.reduce(
      (previous, sample, index) =>
        previous.then(() =>
          this.servicesRepository.create({
            ...sample,
            deposit_cents: sample.deposit_cents ?? null,
            position: index + 1,
          }),
        ),
      Promise.resolve() as Promise<unknown>,
    );
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
