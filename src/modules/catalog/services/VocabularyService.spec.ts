import 'reflect-metadata';
import { runWithTenant } from '@shared/tenancy/TenantContext';
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
    const result = await runWithTenant(tenant('physio'), () =>
      new VocabularyService().get(),
    );

    expect(result.segment).toBe('physio');
    expect(result.vocabulary).toMatchObject({
      professional: 'Fisioterapeuta',
      client: 'Paciente',
      place: 'Clínica',
    });
  });

  it('should treat tenants without segment as barbershops', async () => {
    const result = await new VocabularyService().get();

    expect(result.vocabulary.professional).toBe('Barbeiro');
  });
});
