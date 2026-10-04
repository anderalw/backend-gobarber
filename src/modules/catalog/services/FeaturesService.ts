import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import { currentTenant } from '@shared/tenancy/TenantContext';
import { FEATURE_KEYS, FeatureKey, segmentOf } from '@modules/tenants/segments';
import ISettingsRepository from '../repositories/ISettingsRepository';

const KEY = 'features';

export type Features = Record<FeatureKey, boolean>;

interface IResponse {
  features: Features;
  // Como o ramo do negócio traz (para mostrar o que é padrão)
  feature_defaults: Features;
}

// Recursos ligados no negócio: o padrão do ramo com o que o admin mudou
@injectable()
class FeaturesService {
  constructor(
    @inject('SettingsRepository')
    private settingsRepository: ISettingsRepository,
  ) {}

  public async get(): Promise<IResponse> {
    const defaults = segmentOf(currentTenant()?.segment).features;
    const saved = await this.settingsRepository.get(KEY);
    let overrides: Partial<Features> = {};

    try {
      overrides = saved ? JSON.parse(saved) : {};
    } catch {
      overrides = {};
    }

    const features = { ...defaults };

    FEATURE_KEYS.forEach(key => {
      if (typeof overrides[key] === 'boolean') {
        features[key] = overrides[key] as boolean;
      }
    });

    return { features, feature_defaults: defaults };
  }

  public async isOn(key: FeatureKey): Promise<boolean> {
    return (await this.get()).features[key];
  }

  // Guarda só o que difere do ramo
  public async update(data: Partial<Features>): Promise<IResponse> {
    const { features, feature_defaults } = await this.get();
    const next = { ...features, ...data };
    const overrides: Partial<Features> = {};

    FEATURE_KEYS.forEach(key => {
      if (typeof next[key] !== 'boolean') {
        throw new AppError('Valor inválido para os recursos.');
      }

      if (next[key] !== feature_defaults[key]) overrides[key] = next[key];
    });

    await this.settingsRepository.set(KEY, JSON.stringify(overrides));

    return this.get();
  }
}

export default FeaturesService;
