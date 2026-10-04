import AppError from '@shared/errors/AppError';
import ICreateServiceDTO from '../dtos/ICreateServiceDTO';

// Regras comuns ao cadastro e à edição de serviços
export default function validateServiceData({
  name,
  duration_minutes,
  price_cents,
  deposit_cents,
}: ICreateServiceDTO): ICreateServiceDTO {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new AppError('Informe o nome do serviço.');
  }

  if (
    !Number.isInteger(duration_minutes) ||
    duration_minutes < 5 ||
    duration_minutes > 480 ||
    duration_minutes % 5 !== 0
  ) {
    throw new AppError(
      'A duração deve ser de 5 a 480 minutos, em múltiplos de 5.',
    );
  }

  if (!Number.isInteger(price_cents) || price_cents < 0) {
    throw new AppError('Informe um valor válido para o serviço.');
  }

  if (
    deposit_cents !== undefined &&
    deposit_cents !== null &&
    (!Number.isInteger(deposit_cents) ||
      deposit_cents < 0 ||
      deposit_cents > price_cents)
  ) {
    throw new AppError('O sinal deve ficar entre zero e o valor do serviço.');
  }

  return {
    name: trimmedName,
    duration_minutes,
    price_cents,
    // Sinal zero é o mesmo que sem sinal
    ...(deposit_cents !== undefined && {
      deposit_cents: deposit_cents || null,
    }),
  };
}
