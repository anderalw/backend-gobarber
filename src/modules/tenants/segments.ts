// Segmentos (ramos de negócio) que usam o sistema. Cada um traz o
// vocabulário das telas e o que o negócio novo já recebe pronto. O
// segmento é escolhido ao criar o negócio e não muda depois; os termos
// podem ser ajustados nas configurações

export type SegmentKey =
  | 'barbershop'
  | 'beauty'
  | 'tattoo'
  | 'physio'
  | 'clinic';

// Termos que aparecem nas telas. place_gender decide "a barbearia" ou
// "o estúdio"
export interface IVocabulary {
  professional: string;
  professionals: string;
  client: string;
  clients: string;
  place: string;
  place_gender: 'f' | 'm';
  // Assinatura mensal com serviços inclusos
  club: string;
}

export const VOCABULARY_FIELDS: Array<keyof IVocabulary> = [
  'professional',
  'professionals',
  'client',
  'clients',
  'place',
  'place_gender',
  'club',
];

interface ISegment {
  key: SegmentKey;
  name: string;
  vocabulary: IVocabulary;
  // Frase da capa do site enquanto o negócio não escreve a dele
  tagline: string;
  // Motivos para bloquear um horário na agenda
  block_reasons: string[];
}

export const SEGMENTS: Record<SegmentKey, ISegment> = {
  barbershop: {
    key: 'barbershop',
    tagline: 'Cortes, barbas e tratamentos com hora marcada.',
    name: 'Barbearia',
    vocabulary: {
      professional: 'Barbeiro',
      professionals: 'Barbeiros',
      client: 'Cliente',
      clients: 'Clientes',
      place: 'Barbearia',
      place_gender: 'f',
      club: 'Clube',
    },
    block_reasons: ['Almoço', 'Consulta', 'Folga', 'Férias'],
  },
  beauty: {
    key: 'beauty',
    tagline: 'Cabelo, unhas e estética com hora marcada.',
    name: 'Salão de beleza / estética',
    vocabulary: {
      professional: 'Profissional',
      professionals: 'Profissionais',
      client: 'Cliente',
      clients: 'Clientes',
      place: 'Salão',
      place_gender: 'm',
      club: 'Clube',
    },
    block_reasons: ['Almoço', 'Curso', 'Folga', 'Férias'],
  },
  tattoo: {
    key: 'tattoo',
    tagline: 'Tatuagens e piercings com hora marcada.',
    name: 'Estúdio de tatuagem',
    vocabulary: {
      professional: 'Tatuador',
      professionals: 'Tatuadores',
      client: 'Cliente',
      clients: 'Clientes',
      place: 'Estúdio',
      place_gender: 'm',
      club: 'Clube',
    },
    block_reasons: ['Almoço', 'Convenção', 'Folga', 'Férias'],
  },
  physio: {
    key: 'physio',
    tagline: 'Fisioterapia e reabilitação com hora marcada.',
    name: 'Fisioterapia',
    vocabulary: {
      professional: 'Fisioterapeuta',
      professionals: 'Fisioterapeutas',
      client: 'Paciente',
      clients: 'Pacientes',
      place: 'Clínica',
      place_gender: 'f',
      club: 'Planos',
    },
    block_reasons: ['Almoço', 'Reunião', 'Folga', 'Férias'],
  },
  clinic: {
    key: 'clinic',
    tagline: 'Consultas com hora marcada, sem espera.',
    name: 'Consultório',
    vocabulary: {
      professional: 'Profissional',
      professionals: 'Profissionais',
      client: 'Paciente',
      clients: 'Pacientes',
      place: 'Consultório',
      place_gender: 'm',
      club: 'Planos',
    },
    block_reasons: ['Almoço', 'Reunião', 'Folga', 'Férias'],
  },
};

export const SEGMENT_KEYS = Object.keys(SEGMENTS) as SegmentKey[];

export const DEFAULT_SEGMENT: SegmentKey = 'barbershop';

export function segmentOf(key?: string | null): ISegment {
  return (
    SEGMENTS[(key as SegmentKey) || DEFAULT_SEGMENT] || SEGMENTS.barbershop
  );
}
