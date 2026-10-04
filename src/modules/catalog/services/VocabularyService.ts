import { injectable } from 'tsyringe';

import { currentTenant } from '@shared/tenancy/TenantContext';
import { segmentOf, IVocabulary } from '@modules/tenants/segments';

interface IResponse {
  segment: string;
  segment_name: string;
  vocabulary: IVocabulary;
}

// Termos das telas (Barbeiro, Paciente, Estúdio...): fixos pelo ramo do
// negócio, escolhido na criação
@injectable()
class VocabularyService {
  public async get(): Promise<IResponse> {
    const segment = segmentOf(currentTenant()?.segment);

    return {
      segment: segment.key,
      segment_name: segment.name,
      vocabulary: segment.vocabulary,
    };
  }
}

export default VocabularyService;
