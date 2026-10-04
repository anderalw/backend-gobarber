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
  | 'waitlist'
  // Sinal para garantir o horário (valor definido em cada serviço)
  | 'deposit'
  // Pacotes de sessões vendidos ao cliente
  | 'packages'
  // Termo de consentimento aceito antes de agendar
  | 'consent';

export const FEATURE_KEYS: FeatureKey[] = [
  'club',
  'any_provider',
  'walk_in',
  'series',
  'waitlist',
  'deposit',
  'packages',
  'consent',
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
  // Texto inicial do termo de consentimento (o negócio pode reescrever)
  consent_text: string;
}

// Termos de consentimento iniciais (modelos: o negócio revisa e ajusta)
const CONSENT_GENERIC = `Declaro que as informações que forneci são verdadeiras e que fui informado(a) sobre o atendimento, seus cuidados e possíveis riscos.

Autorizo o uso dos meus dados pessoais apenas para o agendamento, o atendimento e o contato sobre ele, conforme a Lei Geral de Proteção de Dados (LGPD).`;

const CONSENT_TATTOO = `Declaro ser maior de 18 anos e que as informações que forneci são verdadeiras.

Informei ao estúdio sobre alergias, uso de medicamentos, doenças de pele, diabetes, problemas de cicatrização ou de coagulação, gravidez ou amamentação.

Fui orientado(a) sobre os riscos do procedimento (como reações alérgicas, inflamação e infecção) e sobre os cuidados após a sessão, e me comprometo a segui-los. Sei que o resultado final depende também da cicatrização e dos meus cuidados.

Autorizo o uso dos meus dados pessoais apenas para o agendamento, o atendimento e o contato sobre ele, conforme a LGPD.`;

const CONSENT_PHYSIO = `Declaro que as informações que forneci sobre minha saúde são verdadeiras e que avisarei sobre qualquer mudança, como dores novas, cirurgias, uso de medicamentos ou gravidez.

Fui informado(a) sobre o tratamento proposto, seus objetivos e possíveis desconfortos, e sei que posso interromper a sessão a qualquer momento.

Autorizo o registro das informações do meu tratamento em prontuário e o uso dos meus dados pessoais apenas para o atendimento e o contato sobre ele, conforme a LGPD.`;

const CONSENT_CLINIC = `Declaro que as informações que forneci sobre minha saúde são verdadeiras e completas, incluindo alergias, medicamentos em uso e condições anteriores.

Fui informado(a) de que posso tirar dúvidas sobre os exames e procedimentos antes de realizá-los e de que posso recusá-los.

Autorizo o registro das informações do atendimento em prontuário e o uso dos meus dados pessoais apenas para o atendimento e o contato sobre ele, conforme a LGPD.`;

export const SEGMENTS: Record<SegmentKey, ISegment> = {
  barbershop: {
    key: 'barbershop',
    consent_text: CONSENT_GENERIC,
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
      deposit: false,
      packages: false,
      consent: false,
    },
    defaults: { buffer_minutes: 0 },
  },
  beauty: {
    key: 'beauty',
    consent_text: CONSENT_GENERIC,
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
      deposit: false,
      packages: true,
      consent: false,
    },
    defaults: { buffer_minutes: 0 },
  },
  tattoo: {
    key: 'tattoo',
    consent_text: CONSENT_TATTOO,
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
      deposit: true,
      packages: false,
      consent: true,
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
    consent_text: CONSENT_PHYSIO,
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
      deposit: false,
      packages: true,
      consent: true,
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
    consent_text: CONSENT_CLINIC,
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
      deposit: false,
      packages: false,
      consent: true,
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
