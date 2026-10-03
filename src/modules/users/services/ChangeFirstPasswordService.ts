import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import User from '../infra/typeorm/entities/User';
import IUsersRepository from '../repositories/IUsersRepository';
import IHashProvider from '../providers/HashProvider/models/IHashProvider';
import staffToken from '../utils/staffToken';

const MIN_PASSWORD = 6;

// Primeiro acesso (ou senha redefinida pelo administrador): troca a senha
// provisória e devolve um token novo, já sem a restrição
@injectable()
class ChangeFirstPasswordService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('HashProvider')
    private hashProvider: IHashProvider,
  ) {}

  public async execute(
    user_id: string,
    password: string,
  ): Promise<{ user: User; token: string }> {
    const user = await this.usersRepository.findById(user_id);

    if (!user) throw new AppError('Usuário não encontrado.', 404);

    if (password.length < MIN_PASSWORD) {
      throw new AppError(
        `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.`,
      );
    }

    if (password.trim().toLowerCase() === user.email.toLowerCase()) {
      throw new AppError('A senha nova não pode ser o seu e-mail.');
    }

    user.password = await this.hashProvider.generateHash(password);
    user.must_change_password = false;

    await this.usersRepository.save(user);

    return { user, token: staffToken(user) };
  }
}

export default ChangeFirstPasswordService;
