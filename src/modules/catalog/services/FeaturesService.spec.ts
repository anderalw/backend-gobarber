import 'reflect-metadata';
import { runWithTenant } from '@shared/tenancy/TenantContext';
import FakeSettingsRepository from '../repositories/fakes/FakeSettingsRepository';
import FeaturesService from './FeaturesService';

const tenant = (segment: string) => ({
  id: '00000000-0000-0000-0000-000000000002',
  slug: 'negocio',
  name: 'Negócio',
  custom_domain: null,
  status: 'active' as const,
  segment,
});

describe('Recursos do negócio', () => {
  it('should start with the features of the segment', async () => {
    const features = new FeaturesService(new FakeSettingsRepository());

    const tattoo = await runWithTenant(tenant('tattoo'), () => features.get());
    const barbershop = await features.get();

    expect(tattoo.features).toMatchObject({ club: false, any_provider: false });
    expect(barbershop.features).toMatchObject({ club: true, walk_in: true });
  });

  it('should let the business turn a feature on and keep only the change', async () => {
    const settings = new FakeSettingsRepository();
    const features = new FeaturesService(settings);

    await runWithTenant(tenant('tattoo'), async () => {
      const result = await features.update({ club: true });

      expect(result.features.club).toBe(true);
      expect(result.feature_defaults.club).toBe(false);
      expect(JSON.parse((await settings.get('features')) as string)).toEqual({
        club: true,
      });

      const back = await features.update({ club: false });

      expect(back.features.club).toBe(false);
      expect(await settings.get('features')).toBe('{}');
    });
  });
});
