// Segmentos (ramos de negócio) que usam o sistema. Cada um traz o
// vocabulário das telas e o que o negócio novo já recebe pronto. O
// segmento é escolhido ao criar o negócio e não muda depois, nem os termos

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

// Recursos que cada ramo traz ligados ou desligados (o admin do negócio
// pode mudar nas configurações)
export type FeatureKey =
  | 'club'
  | 'any_provider'
  | 'walk_in'
  | 'series'
  | 'waitlist';

export const FEATURE_KEYS: FeatureKey[] = [
  'club',
  'any_provider',
  'walk_in',
  'series',
  'waitlist',
];

type Rule = { show: boolean; required: boolean };

// O que o negócio novo recebe pronto (só na criação)
interface ISegmentDefaults {
  // Intervalo entre atendimentos (minutos)
  buffer_minutes: number;
  // Campos do cadastro de clientes (o resto fica no padrão do sistema)
  profile_fields?: {
    client_site?: Partial<Record<'cpf' | 'birth_date' | 'address', Rule>>;
    client_counter?: Partial<
      Record<'email' | 'cpf' | 'birth_date' | 'address', Rule>
    >;
  };
}

const ON = { show: true, required: true };
const SHOW = { show: true, required: false };

interface ISegment {
  key: SegmentKey;
  name: string;
  vocabulary: IVocabulary;
  // Frase da capa do site enquanto o negócio não escreve a dele
  tagline: string;
  // Motivos para bloquear um horário na agenda
  block_reasons: string[];
  features: Record<FeatureKey, boolean>;
  defaults: ISegmentDefaults;
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
    features: {
      club: true,
      any_provider: true,
      walk_in: true,
      series: true,
      waitlist: true,
    },
    defaults: { buffer_minutes: 0 },
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
    features: {
      club: true,
      any_provider: true,
      walk_in: true,
      series: true,
      waitlist: true,
    },
    defaults: { buffer_minutes: 0 },
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
    features: {
      club: false,
      any_provider: false,
      walk_in: false,
      series: true,
      waitlist: true,
    },
    // Maior de idade: CPF e nascimento no cadastro pelo site
    defaults: {
      buffer_minutes: 15,
      profile_fields: {
        client_site: { cpf: ON, birth_date: ON },
        client_counter: { cpf: SHOW, birth_date: SHOW },
      },
    },
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
    features: {
      club: true,
      any_provider: false,
      walk_in: false,
      series: true,
      waitlist: true,
    },
    defaults: {
      buffer_minutes: 10,
      profile_fields: {
        client_site: { cpf: ON, birth_date: ON },
        client_counter: { cpf: SHOW, birth_date: SHOW },
      },
    },
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
    features: {
      club: true,
      any_provider: false,
      walk_in: false,
      series: true,
      waitlist: true,
    },
    defaults: {
      buffer_minutes: 10,
      profile_fields: {
        client_site: { cpf: ON, birth_date: ON },
        client_counter: { cpf: SHOW, birth_date: SHOW },
      },
    },
  },
};

export const SEGMENT_KEYS = Object.keys(SEGMENTS) as SegmentKey[];

export const DEFAULT_SEGMENT: SegmentKey = 'barbershop';

export function segmentOf(key?: string | null): ISegment {
  return (
    SEGMENTS[(key as SegmentKey) || DEFAULT_SEGMENT] || SEGMENTS.barbershop
  );
}
