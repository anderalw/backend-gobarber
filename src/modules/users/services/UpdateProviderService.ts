import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';
import User from '../infra/typeorm/entities/User';
import IUsersRepository from '../repositories/IUsersRepository';

interface IRequest {
  provider_id: string;
  name: string;
  email: string;
}

// Administrador corrige nome e e-mail de um barbeiro. A senha continua
// sendo do barbeiro (perfil ou "Esqueci minha senha")
@injectable()
class UpdateProviderService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('CacheProvider')
    private cacheProvider: ICacheProvider,
  ) {}

  public async execute({ provider_id, name, email }: IRequest): Promise<User> {
    const provider = await this.usersRepository.findById(provider_id);

    if (!provider) {
      throw new AppError('Barbeiro não encontrado.', 404);
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      throw new AppError('Informe o nome do barbeiro.');
    }

    const emailOwner = await this.usersRepository.findByEmail(cleanEmail);

    if (emailOwner && emailOwner.id !== provider_id) {
      throw new AppError('Este e-mail já está em uso por outro barbeiro.');
    }

    provider.name = cleanName;
    provider.email = cleanEmail;

    await this.usersRepository.save(provider);

    // O nome aparece na lista de barbeiros, que fica em cache
    await this.cacheProvider.invalidatePrefix('providers-list');

    return provider;
  }
}

export default UpdateProviderService;
