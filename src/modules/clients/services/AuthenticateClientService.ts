import { sign } from 'jsonwebtoken';
import { injectable, inject } from 'tsyringe';

import authConfig from '@config/auth';
import AppError from '@shared/errors/AppError';
import IHashProvider from '@modules/users/providers/HashProvider/models/IHashProvider';
import Client from '../infra/typeorm/entities/Client';
import IClientsRepository from '../repositories/IClientsRepository';

// Vamos reaproveitar o provedor de Hash que já existe nos users

interface IRequest {
  email: string;
  password?: string;
}

interface IResponse {
  client: Client;
  token: string;
}

@injectable()
class AuthenticateClientService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,

    @inject('HashProvider')
    private hashProvider: IHashProvider,
  ) {}

  public async execute({ email, password }: IRequest): Promise<IResponse> {
    const client = await this.clientsRepository.findByEmail(email);

    if (!client) {
      throw new AppError('E-mail ou senha incorretos.', 401);
    }

    // Compara a password em texto limpo com a password encriptada na base de dados
    const passwordMatched = await this.hashProvider.compareHash(
      password || '',
      client.password,
    );

    if (!passwordMatched) {
      throw new AppError('E-mail ou senha incorretos.', 401);
    }

    const { secret, expiresIn } = authConfig.jwt;

    // Gera o Token JWT para o cliente
    const token = sign({ role: 'client' }, secret, {
      subject: client.id,
      expiresIn,
    });

    return {
      client,
      token,
    };
  }
}

export default AuthenticateClientService;
