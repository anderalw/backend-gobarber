// Sem entidades do TypeORM (que carregam o polyfill), o tsyringe precisa dele
import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';
import TerminalRegistry from '../providers/TerminalProvider/TerminalRegistry';
import ITerminalProvider, {
  ITerminalCredentialField,
  ITerminalCredentials,
} from '../providers/TerminalProvider/models/ITerminalProvider';
import ITerminalDevicesRepository from '../repositories/ITerminalDevicesRepository';
import { open, seal } from '../utils/secretBox';

const PROVIDER_KEY = 'terminal_provider';
// Uma por operadora: trocar de operadora e voltar não perde o cadastro
const credentialsKey = (provider: string): string =>
  `terminal_credentials:${provider}`;

export interface IRegisteredDevice {
  id: string;
  name: string;
  external_id: string;
  active: boolean;
}

export interface ITerminalSettings {
  // Operadora em uso; null = cobrança na maquininha desligada
  provider: string | null;
  provider_label: string | null;
  // A conta da operadora está conectada (credenciais salvas e válidas)
  connected: boolean;
  // Maquininhas ativas, para escolher na hora de cobrar
  devices: Array<{ id: string; name: string }>;
  // Operadoras que podem ser escolhidas e o que cada uma pede
  available: Array<{
    key: string;
    label: string;
    setup_help: string;
    device_id_label: string;
    device_id_help: string;
    credential_fields: ITerminalCredentialField[];
  }>;
  // Operadoras que ainda vão ser integradas (só para mostrar)
  upcoming: Array<{ key: string; label: string }>;
  // Só para o admin: todas as maquininhas e as credenciais mascaradas
  registered?: IRegisteredDevice[];
  credentials?: Record<string, string>;
}

export interface IActiveTerminal {
  provider: ITerminalProvider;
  credentials: ITerminalCredentials;
}

// Segredos voltam só com os últimos caracteres
function mask(value: string): string {
  return value.length > 8 ? `••••${value.slice(-4)}` : '••••';
}

// Qual operadora de maquininha a barbearia usa, a conta dela e as
// maquininhas cadastradas (tudo escolha do admin)
@injectable()
class TerminalSettingsService {
  constructor(
    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,

    @inject('TerminalDevicesRepository')
    private devicesRepository: ITerminalDevicesRepository,

    @inject(TerminalRegistry)
    private registry: TerminalRegistry,
  ) {}

  // A operadora escolhida (conectada ou não), ou null
  public async selectedProvider(): Promise<ITerminalProvider | null> {
    const key = await this.settingsRepository.get(PROVIDER_KEY);

    return (key && this.registry.get(key)) || null;
  }

  // Credenciais salvas de uma operadora (vazio: nunca conectada)
  public async credentialsFor(provider: string): Promise<ITerminalCredentials> {
    const sealed = await this.settingsRepository.get(credentialsKey(provider));
    const json = sealed ? open(sealed) : undefined;

    if (!json) return {};

    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  }

  // Operadora em uso com a conta conectada; null = não dá para cobrar
  public async active(): Promise<IActiveTerminal | null> {
    const provider = await this.selectedProvider();

    if (!provider) return null;

    const credentials = await this.credentialsFor(provider.key);

    return this.isComplete(provider, credentials)
      ? { provider, credentials }
      : null;
  }

  public async get(admin = false): Promise<ITerminalSettings> {
    const provider = await this.selectedProvider();
    const credentials = provider ? await this.credentialsFor(provider.key) : {};
    const connected = !!provider && this.isComplete(provider, credentials);
    const registered = provider
      ? await this.devicesRepository.findByProvider(provider.key)
      : [];

    const settings: ITerminalSettings = {
      provider: provider ? provider.key : null,
      provider_label: provider ? provider.label : null,
      connected,
      devices: connected
        ? registered
            .filter(device => device.active)
            .map(device => ({ id: device.id, name: device.name }))
        : [],
      available: this.registry.list().map(item => ({
        key: item.key,
        label: item.label,
        setup_help: item.setupHelp,
        device_id_label: item.deviceIdLabel,
        device_id_help: item.deviceIdHelp,
        credential_fields: item.credentialFields,
      })),
      upcoming: this.registry.upcoming(),
    };

    if (admin) {
      settings.registered = registered.map(device => ({
        id: device.id,
        name: device.name,
        external_id: device.external_id,
        active: device.active,
      }));
      settings.credentials = Object.fromEntries(
        (provider?.credentialFields || [])
          .filter(field => credentials[field.key])
          .map(field => [
            field.key,
            field.secret
              ? mask(credentials[field.key])
              : credentials[field.key],
          ]),
      );
    }

    return settings;
  }

  // Escolhe a operadora e conecta a conta. Segredo em branco mantém o salvo
  public async update(
    providerKey: string | null,
    values: ITerminalCredentials = {},
  ): Promise<ITerminalSettings> {
    if (!providerKey) {
      // Desligar não apaga a conta: religar não pede tudo de novo
      await this.settingsRepository.set(PROVIDER_KEY, '');

      return this.get(true);
    }

    const provider = this.registry.get(providerKey);

    if (!provider) {
      throw new AppError('Operadora não disponível.');
    }

    const saved = await this.credentialsFor(provider.key);
    const credentials: ITerminalCredentials = {};

    provider.credentialFields.forEach(field => {
      const value = (values[field.key] || '').trim();

      if (value) {
        credentials[field.key] = value;
      } else if (saved[field.key] && (field.secret || field.required)) {
        credentials[field.key] = saved[field.key];
      }

      if (field.required && !credentials[field.key]) {
        throw new AppError(`Informe: ${field.label}.`);
      }
    });

    // Só salva o que a operadora aceitou
    await provider.verify(credentials);

    await this.settingsRepository.set(
      credentialsKey(provider.key),
      seal(JSON.stringify(credentials)),
    );
    await this.settingsRepository.set(PROVIDER_KEY, provider.key);

    return this.get(true);
  }

  // "Testar conexão": confere a conta salva com a operadora
  public async test(): Promise<void> {
    const terminal = await this.active();

    if (!terminal) {
      throw new AppError('Conecte a conta da operadora primeiro.');
    }

    await terminal.provider.verify(terminal.credentials);
  }

  private isComplete(
    provider: ITerminalProvider,
    credentials: ITerminalCredentials,
  ): boolean {
    return provider.credentialFields.every(
      field => !field.required || !!credentials[field.key],
    );
  }
}

export default TerminalSettingsService;
