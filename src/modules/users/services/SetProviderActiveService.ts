import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';
import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import User from '../infra/typeorm/entities/User';
import IUsersRepository from '../repositories/IUsersRepository';

interface IRequest {
  // Administrador que fez o pedido
  requester_id: string;
  provider_id: string;
  active: boolean;
}

// Ativa ou desativa um usuário da equipe (desativado não entra no sistema).
// Barbeiro, para desativar, não pode ter agendamentos futuros: o
// administrador remarca ou cancela antes, para nenhum cliente ficar com um
// horário que não vai acontecer. E sempre fica algum administrador ativo
@injectable()
class SetProviderActiveService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('CacheProvider')
    private cacheProvider: ICacheProvider,
  ) {}

  public async execute({
    requester_id,
    provider_id,
    active,
  }: IRequest): Promise<User> {
    const provider = await this.usersRepository.findById(provider_id);

    if (!provider) {
      throw new AppError('Usuário não encontrado.', 404);
    }

    if (!active) {
      if (provider_id === requester_id) {
        throw new AppError('Você não pode desativar a sua própria conta.');
      }

      if (provider.role?.isAdmin) {
        const others = (await this.usersRepository.findAllStaff()).filter(
          user => user.id !== provider_id && user.active && user.role?.isAdmin,
        );

        if (others.length === 0) {
          throw new AppError(
            'A barbearia precisa de pelo menos um administrador ativo.',
          );
        }
      }

      const upcoming = provider.is_barber
        ? await this.appointmentsRepository.countUpcomingFromProvider(
            provider_id,
            new Date(),
          )
        : 0;

      if (upcoming > 0) {
        throw new AppError(
          `${provider.name} tem ${
            upcoming === 1
              ? '1 agendamento futuro'
              : `${upcoming} agendamentos futuros`
          }. Remarque para outro barbeiro ou cancele antes de desativar.`,
        );
      }
    }

    provider.active = active;

    await this.usersRepository.save(provider);

    // Some (ou volta) da lista de barbeiros dos clientes
    await this.cacheProvider.invalidatePrefix('providers-list');

    return provider;
  }
}

export default SetProviderActiveService;
