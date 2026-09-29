import AppError from '@shared/errors/AppError';
import User from '@modules/users/infra/typeorm/entities/User';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import Appointment from '../infra/typeorm/entities/Appointment';

// Barbeiros escolhidos para um bloqueio (sem repetir), na ordem pedida
export async function findBlockProviders(
  usersRepository: IUsersRepository,
  provider_ids: string[],
): Promise<User[]> {
  const ids = Array.from(new Set(provider_ids));

  if (ids.length === 0) {
    throw new AppError('Escolha pelo menos um barbeiro.');
  }

  const providers = await Promise.all(
    ids.map(id => usersRepository.findById(id)),
  );

  if (providers.some(provider => !provider)) {
    throw new AppError('Barbeiro não encontrado.');
  }

  return providers as User[];
}

interface IProviderConflicts {
  provider: User;
  // Atendimentos marcados que cairiam no bloqueio
  appointments: Appointment[];
}

const plural = (count: number): string =>
  count === 1 ? '1 agendamento' : `${count} agendamentos`;

// Recusa o bloqueio se algum barbeiro tem atendimentos no período. Com um
// barbeiro só, a mensagem é a de sempre; com vários, diz quem tem conflito.
// Nada é gravado enquanto houver conflito em algum deles
export function ensureNoConflicts(
  conflicts: IProviderConflicts[],
  // Ex: 'neste período', 'nesses horários'
  where: string,
  // Detalhe do primeiro atendimento, quando ajuda (ex: '(01/10 às 12:00)')
  detail: (appointments: Appointment[]) => string = () => '',
): void {
  const found = conflicts.filter(item => item.appointments.length > 0);

  if (found.length === 0) return;

  const advice = 'Cancele ou remarque antes de bloquear.';

  if (conflicts.length === 1) {
    const { appointments } = found[0];
    const extra = detail(appointments);

    throw new AppError(
      `Há ${plural(appointments.length)} ${where}${
        extra ? ` ${extra}` : ''
      }. ${advice}`,
    );
  }

  const names = found.map(
    ({ provider, appointments }) =>
      `${provider.name} (${plural(appointments.length)})`,
  );
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;

  throw new AppError(`Há agendamentos ${where}: ${list}. ${advice}`);
}
