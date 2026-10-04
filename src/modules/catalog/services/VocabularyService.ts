import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import { currentTenant } from '@shared/tenancy/TenantContext';
import {
  segmentOf,
  IVocabulary,
  VOCABULARY_FIELDS,
} from '@modules/tenants/segments';
import ISettingsRepository from '../repositories/ISettingsRepository';

const KEY = 'vocabulary';

interface IResponse {
  segment: string;
  segment_name: string;
  vocabulary: IVocabulary;
  // Os termos do segmento, para "voltar ao padrão"
  defaults: IVocabulary;
}

// Termos das telas (Barbeiro, Paciente, Estúdio...): vêm do segmento do
// negócio e podem ser ajustados nas configurações
@injectable()
class VocabularyService {
  constructor(
    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,
  ) {}

  public async get(): Promise<IResponse> {
    const segment = segmentOf(currentTenant()?.segment);
    const saved = await this.settingsRepository.get(KEY);
    let overrides: Partial<IVocabulary> = {};

    try {
      overrides = saved ? JSON.parse(saved) : {};
    } catch {
      overrides = {};
    }

    const vocabulary = { ...segment.vocabulary };

    VOCABULARY_FIELDS.forEach(field => {
      const value = overrides[field];

      if (typeof value === 'string' && value.trim()) {
        Object.assign(vocabulary, { [field]: value.trim() });
      }
    });

    return {
      segment: segment.key,
      segment_name: segment.name,
      vocabulary,
      defaults: segment.vocabulary,
    };
  }

  // Termo vazio ou igual ao do segmento: volta ao padrão
  public async update(data: Partial<IVocabulary>): Promise<IResponse> {
    const { defaults } = await this.get();
    const overrides: Partial<IVocabulary> = {};

    VOCABULARY_FIELDS.forEach(field => {
      const value = data[field];

      if (value === undefined || value === null) return;

      const text = String(value).trim();

      if (field === 'place_gender' && text && !['f', 'm'].includes(text)) {
        throw new AppError('Escolha "a" ou "o" para o nome do negócio.');
      }

      if (text && text !== defaults[field]) {
        Object.assign(overrides, { [field]: text });
      }
    });

    await this.settingsRepository.set(KEY, JSON.stringify(overrides));

    return this.get();
  }
}

export default VocabularyService;
