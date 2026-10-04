import { injectable, inject } from 'tsyringe';
import path from 'path';
import { addHours, isAfter } from 'date-fns';

import mailConfig from '@config/mail';
import AppError from '@shared/errors/AppError';
import IMailProvider from '@shared/container/providers/MailProvider/models/IMailProvider';
import IHashProvider from '@modules/users/providers/HashProvider/models/IHashProvider';
import BrandingService from '@modules/catalog/services/BrandingService';
import { webUrl } from '@shared/tenancy/hosts';
import IClientsRepository from '../repositories/IClientsRepository';
import IClientTokensRepository from '../repositories/IClientTokensRepository';

// Quanto tempo o link de recuperação vale
const TOKEN_HOURS = 2;

// "Esqueci minha senha" do cliente: manda um link por e-mail e, com ele,
// define a senha nova. Quem entrava só com o Google também pode criar uma
@injectable()
class ClientPasswordRecoveryService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,

    @inject('ClientTokensRepository')
    private clientTokensRepository: IClientTokensRepository,

    @inject('MailProvider')
    private mailProvider: IMailProvider,

    @inject('HashProvider')
    private hashProvider: IHashProvider,

    @inject(BrandingService)
    private branding: BrandingService,
  ) {}

  // Não conta se o e-mail existe: a resposta é sempre a mesma
  public async sendLink(email: string): Promise<void> {
    const client = await this.clientsRepository.findByEmail(
      email.trim().toLowerCase(),
    );

    if (!client || !client.email) return;

    const { token } = await this.clientTokensRepository.generate(client.id);
    const brand = await this.branding.get();

    await this.mailProvider.sendMail({
      from: {
        name: `Equipe ${brand.name}`,
        email: mailConfig.defaults.from.email,
      },
      to: { name: client.name, email: client.email },
      subject: `[${brand.name}] Recuperação de senha`,
      templateData: {
        file: path.resolve(
          __dirname,
          '..',
          '..',
          'users',
          'views',
          'forgot_password.hbs',
        ),
        variables: {
          shopName: brand.name,
          name: client.name,
          link: `${webUrl()}/cliente/redefinir-senha?token=${token}`,
        },
      },
    });
  }

  public async reset(token: string, password: string): Promise<void> {
    const clientToken = await this.clientTokensRepository.findByToken(token);
    const client =
      clientToken &&
      (await this.clientsRepository.findById(clientToken.client_id));

    if (!clientToken || !client) {
      throw new AppError('Link de recuperação inválido.');
    }

    if (isAfter(Date.now(), addHours(clientToken.created_at, TOKEN_HOURS))) {
      throw new AppError('O link de recuperação expirou, peça um novo.');
    }

    client.password = await this.hashProvider.generateHash(password);

    await this.clientsRepository.save(client);
    await this.clientTokensRepository.deleteFromClient(client.id);
  }
}

export default ClientPasswordRecoveryService;
