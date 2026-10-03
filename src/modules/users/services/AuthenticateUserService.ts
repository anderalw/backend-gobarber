import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import IUsersRepository from '../repositories/IUsersRepository';
import IHashProvider from '../providers/HashProvider/models/IHashProvider';

import User from '../infra/typeorm/entities/User';
import staffToken from '../utils/staffToken';

interface IRequest {
  email: string;
  password: string;
}

interface IResponse {
  user: User;
  token: string;
}

@injectable()
class AuthenticateUserService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('HashProvider')
    private hashProvider: IHashProvider,
  ) {}

  public async execute({ email, password }: IRequest): Promise<IResponse> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      throw new AppError('E-mail ou senha incorretos.', 401);
    }

    let passwordMatched = await this.hashProvider.compareHash(
      password,
      user.password,
    );

    // Senha provisória é o e-mail: aceita digitado com maiúsculas
    if (!passwordMatched && user.must_change_password) {
      passwordMatched = await this.hashProvider.compareHash(
        password.trim().toLowerCase(),
        user.password,
      );
    }

    if (!passwordMatched) {
      throw new AppError('E-mail ou senha incorretos.', 401);
    }

    // Conferido depois da senha, para não revelar quais contas existem
    if (!user.active) {
      throw new AppError(
        'Esta conta está desativada. Fale com o administrador da barbearia.',
        401,
      );
    }

    const token = staffToken(user);

    return {
      user,
      token,
    };
  }
}

export default AuthenticateUserService;
