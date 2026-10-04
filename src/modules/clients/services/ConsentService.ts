import { createHash } from 'crypto';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import { currentTenant } from '@shared/tenancy/TenantContext';
import { segmentOf } from '@modules/tenants/segments';
import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';
import FeaturesService from '@modules/catalog/services/FeaturesService';
import IClientsRepository from '../repositories/IClientsRepository';

const KEY = 'consent_text';

export const MAX_CONSENT_LENGTH = 5000;

interface ITerm {
  text: string;
  // Muda junto com o texto: mudar o termo pede um novo aceite
  version: string;
}

interface IStatus extends ITerm {
  // Recurso ligado no negócio
  required: boolean;
  // Aceitou o texto atual
  accepted: boolean;
  accepted_at: Date | null;
  // Aceite registrado na recepção (false = pelo site)
  in_person: boolean;
}

// Termo de consentimento: o texto do negócio (o modelo do ramo enquanto ele
// não escreve o dele) e o aceite de cada cliente
@injectable()
class ConsentService {
  constructor(
    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,

    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,

    @inject(FeaturesService)
    private features: FeaturesService,
  ) {}

  public async term(): Promise<ITerm> {
    const saved = await this.settingsRepository.get(KEY);
    const text =
      saved && saved.trim()
        ? saved
        : segmentOf(currentTenant()?.segment).consent_text;

    return {
      text,
      version: createHash('sha1').update(text).digest('hex').slice(0, 12),
    };
  }

  public async update(text: string): Promise<ITerm> {
    const value = text.trim();

    if (value.length > MAX_CONSENT_LENGTH) {
      throw new AppError('O termo pode ter até 5000 caracteres.');
    }

    // Vazio volta ao modelo do ramo
    await this.settingsRepository.set(KEY, value);

    return this.term();
  }

  public async status(client_id: string): Promise<IStatus> {
    const client = await this.clientsRepository.findById(client_id);

    if (!client) {
      throw new AppError('Cliente não encontrado.', 404);
    }

    const term = await this.term();
    const accepted = client.consent_version === term.version;

    return {
      ...term,
      required: await this.features.isOn('consent'),
      accepted,
      accepted_at: accepted ? client.consent_accepted_at : null,
      in_person: accepted && !!client.consent_by,
    };
  }

  // version: o texto que o cliente leu (se o termo mudou no meio, recusa)
  public async accept(
    client_id: string,
    version: string | null,
    registered_by: string | null = null,
  ): Promise<IStatus> {
    const client = await this.clientsRepository.findById(client_id);

    if (!client) {
      throw new AppError('Cliente não encontrado.', 404);
    }

    const term = await this.term();

    if (version && version !== term.version) {
      throw new AppError('O termo foi atualizado. Leia de novo para aceitar.');
    }

    client.consent_version = term.version;
    client.consent_accepted_at = new Date(Date.now());
    client.consent_by = registered_by;
    await this.clientsRepository.save(client);

    return this.status(client_id);
  }

  // Agendamento pelo site: com o recurso ligado, só depois do aceite
  public async ensureAccepted(client_id: string): Promise<void> {
    if (!(await this.features.isOn('consent'))) return;

    const { accepted } = await this.status(client_id);

    if (!accepted) {
      throw new AppError(
        'Leia e aceite o termo de consentimento para agendar.',
        400,
      );
    }
  }
}

export default ConsentService;
