// Sem entidades do TypeORM (que carregam o polyfill), o tsyringe precisa dele
import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';
import TerminalRegistry from '../providers/TerminalProvider/TerminalRegistry';
import ITerminalProvider, {
  ITerminalDevice,
} from '../providers/TerminalProvider/models/ITerminalProvider';

const PROVIDER_KEY = 'terminal_provider';

export interface ITerminalSettings {
  // Operadora em uso; null = cobrança na maquininha desligada
  provider: string | null;
  provider_label: string | null;
  devices: ITerminalDevice[];
  // Operadoras que podem ser escolhidas
  available: Array<{ key: string; label: string }>;
}

// Qual operadora de maquininha a barbearia usa (escolha do admin)
@injectable()
class TerminalSettingsService {
  constructor(
    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,

    @inject(TerminalRegistry)
    private registry: TerminalRegistry,
  ) {}

  // A operadora em uso, ou null
  public async activeProvider(): Promise<ITerminalProvider | null> {
    const key = await this.settingsRepository.get(PROVIDER_KEY);

    return (key && this.registry.get(key)) || null;
  }

  public async get(): Promise<ITerminalSettings> {
    const provider = await this.activeProvider();

    return {
      provider: provider ? provider.key : null,
      provider_label: provider ? provider.label : null,
      devices: provider ? await provider.listDevices() : [],
      available: this.registry
        .list()
        .map(item => ({ key: item.key, label: item.label })),
    };
  }

  public async update(provider: string | null): Promise<ITerminalSettings> {
    if (provider && !this.registry.get(provider)) {
      throw new AppError('Operadora não disponível.');
    }

    await this.settingsRepository.set(PROVIDER_KEY, provider || '');

    return this.get();
  }
}

export default TerminalSettingsService;
