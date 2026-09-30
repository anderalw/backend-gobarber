// Sem entidades do TypeORM (que carregam o polyfill), o tsyringe precisa dele
import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import { open, seal } from '@shared/utils/secretBox';
import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';
import WhatsAppRegistry from '../providers/WhatsAppProvider/WhatsAppRegistry';
import IWhatsAppProvider, {
  IWhatsAppCredentialField,
  IWhatsAppCredentials,
} from '../providers/WhatsAppProvider/models/IWhatsAppProvider';
import { MessageKind } from '../infra/typeorm/entities/WhatsAppMessage';

const PROVIDER_KEY = 'whatsapp_provider';
const GROUPS_KEY = 'whatsapp_groups';
const credentialsKey = (provider: string): string =>
  `whatsapp_credentials:${provider}`;
// Chave de cifra própria das credenciais de WhatsApp
const PURPOSE = 'whatsapp-credentials';

// Grupos de mensagens que a barbearia liga ou desliga
export type MessageGroup =
  | 'reminder'
  | 'appointments'
  | 'waitlist'
  | 'membership';

export const MESSAGE_GROUPS: MessageGroup[] = [
  'reminder',
  'appointments',
  'waitlist',
  'membership',
];

export const GROUP_OF: Record<MessageKind, MessageGroup> = {
  reminder: 'reminder',
  appointment_created: 'appointments',
  appointment_rescheduled: 'appointments',
  appointment_canceled: 'appointments',
  series_created: 'appointments',
  series_canceled: 'appointments',
  waitlist_slot: 'waitlist',
  membership_due: 'membership',
  membership_overdue: 'membership',
};

export interface IWhatsAppSettings {
  // null = WhatsApp desligado
  provider: string | null;
  provider_label: string | null;
  automatic: boolean;
  // Grupos de mensagens ligados
  groups: MessageGroup[];
  available: Array<{
    key: string;
    label: string;
    description: string;
    automatic: boolean;
    credential_fields: IWhatsAppCredentialField[];
  }>;
  upcoming: Array<{ key: string; label: string }>;
  // Segredos mascarados (••••1234)
  credentials: Record<string, string>;
}

export interface IActiveWhatsApp {
  provider: IWhatsAppProvider;
  credentials: IWhatsAppCredentials;
  groups: MessageGroup[];
}

function mask(value: string): string {
  return value.length > 8 ? `••••${value.slice(-4)}` : '••••';
}

// Como a barbearia manda WhatsApp e quais mensagens (escolha do admin)
@injectable()
class WhatsAppSettingsService {
  constructor(
    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,

    @inject(WhatsAppRegistry)
    private registry: WhatsAppRegistry,
  ) {}

  // Provedor em uso, com as credenciais e os grupos ligados; null = desligado
  public async active(): Promise<IActiveWhatsApp | null> {
    const key = await this.settingsRepository.get(PROVIDER_KEY);
    const provider = (key && this.registry.get(key)) || null;

    if (!provider) return null;

    return {
      provider,
      credentials: await this.credentialsFor(provider.key),
      groups: await this.groups(),
    };
  }

  public async get(): Promise<IWhatsAppSettings> {
    const active = await this.active();

    return {
      provider: active ? active.provider.key : null,
      provider_label: active ? active.provider.label : null,
      automatic: !!active?.provider.automatic,
      groups: active ? active.groups : await this.groups(),
      available: this.registry.list().map(item => ({
        key: item.key,
        label: item.label,
        description: item.description,
        automatic: item.automatic,
        credential_fields: item.credentialFields,
      })),
      upcoming: this.registry.upcoming(),
      credentials: Object.fromEntries(
        (active?.provider.credentialFields || [])
          .filter(field => active?.credentials[field.key])
          .map(field => {
            const value = (active as IActiveWhatsApp).credentials[field.key];

            return [field.key, field.secret ? mask(value) : value];
          }),
      ),
    };
  }

  // Escolhe o provedor (null desliga), conecta e define os grupos ligados.
  // Segredo em branco mantém o salvo
  public async update({
    provider: providerKey,
    credentials: values = {},
    groups,
  }: {
    provider: string | null;
    credentials?: IWhatsAppCredentials;
    groups: MessageGroup[];
  }): Promise<IWhatsAppSettings> {
    const valid = groups.filter(group => MESSAGE_GROUPS.includes(group));

    await this.settingsRepository.set(GROUPS_KEY, JSON.stringify(valid));

    if (!providerKey) {
      await this.settingsRepository.set(PROVIDER_KEY, '');

      return this.get();
    }

    const provider = this.registry.get(providerKey);

    if (!provider) {
      throw new AppError('Forma de envio não disponível.');
    }

    const saved = await this.credentialsFor(provider.key);
    const credentials: IWhatsAppCredentials = {};

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

    await provider.verify(credentials);

    await this.settingsRepository.set(
      credentialsKey(provider.key),
      seal(JSON.stringify(credentials), PURPOSE),
    );
    await this.settingsRepository.set(PROVIDER_KEY, provider.key);

    return this.get();
  }

  private async groups(): Promise<MessageGroup[]> {
    const saved = await this.settingsRepository.get(GROUPS_KEY);

    // Nunca configurado: todas ligadas
    if (!saved) return MESSAGE_GROUPS;

    try {
      return JSON.parse(saved);
    } catch {
      return MESSAGE_GROUPS;
    }
  }

  private async credentialsFor(
    provider: string,
  ): Promise<IWhatsAppCredentials> {
    const sealed = await this.settingsRepository.get(credentialsKey(provider));
    const json = sealed ? open(sealed, PURPOSE) : undefined;

    if (!json) return {};

    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  }
}

export default WhatsAppSettingsService;
