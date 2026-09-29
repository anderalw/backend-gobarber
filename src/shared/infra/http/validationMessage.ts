// Tradução dos erros de validação do Joi (celebrate) para mensagens em
// português, para o front mostrar o motivo em vez de um erro genérico

interface IValidationDetail {
  type: string;
  path: Array<string | number>;
  context?: {
    key?: string;
    label?: string;
    limit?: number | string;
  };
}

// Nome de cada campo como aparece nas telas
const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  email: 'E-mail',
  password: 'Senha',
  old_password: 'Senha atual',
  password_confirmation: 'Confirmação da senha',
  phone: 'Telefone',
  token: 'Link de recuperação',
  provider_id: 'Barbeiro',
  client_id: 'Cliente',
  service_id: 'Serviço',
  appointment_id: 'Agendamento',
  date: 'Data',
  day: 'Dia',
  month: 'Mês',
  year: 'Ano',
  duration_minutes: 'Duração',
  price_cents: 'Valor',
  buffer_minutes: 'Intervalo',
  active: 'Situação',
  search: 'Busca',
  schedules: 'Horários',
  day_of_week: 'Dia da semana',
  start_time: 'Início',
  end_time: 'Fim',
  start_date: 'Início',
  end_date: 'Fim',
  reason: 'Motivo',
  starts_on: 'Data inicial',
  ends_on: 'Data final',
};

function fieldLabel(detail: IValidationDetail): string {
  // Em listas (ex: schedules.0.start_time) vale o último nome do caminho
  const key =
    [...detail.path].reverse().find(part => typeof part === 'string') ||
    detail.context?.key ||
    '';

  return FIELD_LABELS[String(key)] || String(key);
}

export default function validationMessage(detail: IValidationDetail): string {
  const label = fieldLabel(detail);
  const limit = detail.context?.limit;

  switch (detail.type) {
    case 'any.required':
    case 'string.empty':
      return `Preencha o campo ${label}.`;
    case 'string.email':
      return 'Informe um e-mail válido.';
    case 'string.min':
      return `O campo ${label} precisa ter pelo menos ${limit} caracteres.`;
    case 'string.max':
      return `O campo ${label} pode ter no máximo ${limit} caracteres.`;
    case 'number.base':
      return `O campo ${label} precisa ser um número.`;
    case 'number.integer':
      return `O campo ${label} precisa ser um número inteiro.`;
    case 'number.min':
      return `O campo ${label} deve ser no mínimo ${limit}.`;
    case 'number.max':
      return `O campo ${label} deve ser no máximo ${limit}.`;
    case 'date.base':
    case 'date.format':
      return 'Informe uma data válida.';
    case 'boolean.base':
      return `O campo ${label} precisa ser sim ou não.`;
    case 'any.only':
      return label === FIELD_LABELS.password_confirmation
        ? 'A confirmação não confere com a senha.'
        : `O valor do campo ${label} não é aceito.`;
    case 'object.unknown':
      return `O campo ${label} não é aceito.`;
    case 'object.xor':
    case 'object.missing':
      return 'Faltam dados na requisição.';
    default:
      return `O campo ${label} é inválido.`;
  }
}
