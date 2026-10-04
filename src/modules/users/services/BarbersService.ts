import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';
import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import User from '../infra/typeorm/entities/User';
import IUsersRepository from '../repositories/IUsersRepository';

// Quem da equipe atende: aparece na agenda, no site e no agendamento.
// Qualquer usuário pode virar barbeiro; deixar de ser não apaga a conta
@injectable()
class BarbersService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('CacheProvider')
    private cacheProvider: ICacheProvider,
  ) {}

  public async add(user_id: string): Promise<User> {
    const user = await this.find(user_id);

    if (!user.active) {
      throw new AppError('Ative o usuário antes de colocá-lo na agenda.');
    }

    if (user.is_barber) {
      throw new AppError(`${user.name} já está na agenda.`);
    }

    user.is_barber = true;

    return this.save(user);
  }

  // Sai da agenda: só sem agendamentos futuros, para nenhum cliente ficar
  // com um horário que não vai acontecer
  public async remove(user_id: string): Promise<User> {
    const user = await this.find(user_id);

    if (!user.is_barber) {
      throw new AppError(`${user.name} não está na agenda.`);
    }

    const upcoming =
      await this.appointmentsRepository.countUpcomingFromProvider(
        user_id,
        new Date(),
      );

    if (upcoming > 0) {
      throw new AppError(
        `${user.name} tem ${
          upcoming === 1
            ? '1 agendamento futuro'
            : `${upcoming} agendamentos futuros`
        }. Remarque para outro barbeiro ou cancele antes.`,
      );
    }

    user.is_barber = false;

    return this.save(user);
  }

  private async find(user_id: string): Promise<User> {
    const user = await this.usersRepository.findById(user_id);

    if (!user) throw new AppError('Usuário não encontrado.', 404);

    return user;
  }

  private async save(user: User): Promise<User> {
    await this.usersRepository.save(user);

    // Entra ou sai da lista de barbeiros dos clientes
    await this.cacheProvider.invalidatePrefix('providers-list');

    return user;
  }
}

export default BarbersService;
