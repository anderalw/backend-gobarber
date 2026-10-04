import validationMessage from './validationMessage';

// Erro no formato que o Joi devolve em error.details
const detail = (
  type: string,
  path: Array<string | number>,
  limit?: number,
): Parameters<typeof validationMessage>[0] => ({
  type,
  path,
  context: { key: String(path[path.length - 1]), limit },
});

describe('validationMessage', () => {
  it('should explain an invalid e-mail', () => {
    expect(validationMessage(detail('string.email', ['email']))).toBe(
      'Informe um e-mail válido.',
    );
  });

  it('should name the missing or empty field', () => {
    expect(validationMessage(detail('any.required', ['name']))).toBe(
      'Preencha o campo Nome.',
    );
    expect(validationMessage(detail('string.empty', ['phone']))).toBe(
      'Preencha o campo Telefone.',
    );
  });

  it('should show length limits', () => {
    expect(validationMessage(detail('string.min', ['password'], 6))).toBe(
      'O campo Senha precisa ter pelo menos 6 caracteres.',
    );
    expect(validationMessage(detail('string.max', ['name'], 100))).toBe(
      'O campo Nome pode ter no máximo 100 caracteres.',
    );
  });

  it('should explain a password confirmation that does not match', () => {
    expect(
      validationMessage(detail('any.only', ['password_confirmation'])),
    ).toBe('A confirmação não confere com a senha.');
  });

  it('should use the last key of nested fields', () => {
    expect(
      validationMessage(detail('any.required', ['schedules', 0, 'start_time'])),
    ).toBe('Preencha o campo Início.');
  });

  it('should explain numbers and dates', () => {
    expect(validationMessage(detail('number.max', ['day'], 31))).toBe(
      'O campo Dia deve ser no máximo 31.',
    );
    expect(validationMessage(detail('date.base', ['date']))).toBe(
      'Informe uma data válida.',
    );
  });

  it('should fall back to a generic message with the field name', () => {
    expect(validationMessage(detail('string.guid', ['provider_id']))).toBe(
      'O campo Profissional é inválido.',
    );
  });
});
