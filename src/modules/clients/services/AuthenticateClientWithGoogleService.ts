import { sign } from 'jsonwebtoken';
import { injectable, inject } from 'tsyringe';

import authConfig from '@config/auth';
import AppError from '@shared/errors/AppError';
import { tenantClaim } from '@shared/tenancy/TenantContext';
import Client from '../infra/typeorm/entities/Client';
import IClientsRepository from '../repositories/IClientsRepository';
import IGoogleTokenProvider from '../providers/GoogleTokenProvider/models/IGoogleTokenProvider';

interface IResponse {
  client: Client;
  token: string;
  // Primeira vez: a conta foi criada agora
  created: boolean;
}

// "Continuar com o Google": entra com a conta Google. Se o e-mail já é de um
// cliente (com conta ou cadastrado pela barbearia), liga as duas; senão cria
// o cliente, que depois informa o telefone
@injectable()
class AuthenticateClientWithGoogleService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,

    @inject('GoogleTokenProvider')
    private googleTokenProvider: IGoogleTokenProvider,
  ) {}

  public async execute(credential: string): Promise<IResponse> {
    const profile = await this.googleTokenProvider.verify(credential);

    // Sem e-mail confirmado, alguém poderia se passar por outro cliente
    if (!profile.email_verified) {
      throw new AppError(
        'O e-mail desta conta Google ainda não foi confirmado.',
        401,
      );
    }

    const email = profile.email.toLowerCase();
    let created = false;

    let client =
      (await this.clientsRepository.findByGoogleId(profile.sub)) ||
      (await this.clientsRepository.findByEmail(email)) ||
      (await this.clientsRepository.findByEmail(profile.email));

    if (client) {
      if (client.google_id !== profile.sub) {
        client.google_id = profile.sub;
        client = await this.clientsRepository.save(client);
      }
    } else {
      created = true;
      client = await this.clientsRepository.create({
        name: profile.name.trim().slice(0, 100),
        email,
        password: null,
        // O cliente informa depois (o telefone é obrigatório para agendar)
        phone: '',
        google_id: profile.sub,
      });
    }

    const { secret, expiresIn } = authConfig.jwt;

    const token = sign({ role: 'client', ...tenantClaim() }, secret, {
      subject: client.id,
      expiresIn,
    });

    return { client, token, created };
  }
}

export default AuthenticateClientWithGoogleService;
