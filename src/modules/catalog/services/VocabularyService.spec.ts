import 'reflect-metadata';
import { runWithTenant } from '@shared/tenancy/TenantContext';
import FakeSettingsRepository from '../repositories/fakes/FakeSettingsRepository';
import VocabularyService from './VocabularyService';

const tenant = (segment: string) => ({
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'clinica',
  name: 'Clínica',
  custom_domain: null,
  status: 'active' as const,
  segment,
});

describe('Vocabulário', () => {
  it('should use the terms of the segment', async () => {
    const vocabulary = new VocabularyService(new FakeSettingsRepository());

    const result = await runWithTenant(tenant('physio'), () =>
      vocabulary.get(),
    );

    expect(result.segment).toBe('physio');
    expect(result.vocabulary).toMatchObject({
      professional: 'Fisioterapeuta',
      client: 'Paciente',
      place: 'Clínica',
    });
  });

  it('should keep only the adjusted terms and go back to the default', async () => {
    const vocabulary = new VocabularyService(new FakeSettingsRepository());

    await runWithTenant(tenant('clinic'), async () => {
      const adjusted = await vocabulary.update({
        professional: 'Dr(a).',
        client: 'Paciente',
      });

      expect(adjusted.vocabulary.professional).toBe('Dr(a).');

      const reset = await vocabulary.update({ professional: '' });

      expect(reset.vocabulary.professional).toBe('Profissional');
    });
  });

  it('should treat tenants without segment as barbershops', async () => {
    const vocabulary = new VocabularyService(new FakeSettingsRepository());

    const result = await vocabulary.get();

    expect(result.vocabulary.professional).toBe('Barbeiro');
  });
});
