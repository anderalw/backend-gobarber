import { injectable, inject } from 'tsyringe';

import path from 'path';
import AppError from '@shared/errors/AppError';
import IMailProvider from '@shared/container/providers/MailProvider/models/IMailProvider';
import BrandingService from '@modules/catalog/services/BrandingService';
import IUsersRepository from '../repositories/IUsersRepository';
import IUserTokensRepository from '../repositories/IUserTokensRepository';

// import User from '../infra/typeorm/entities/User';

interface IRequest {
  email: string;
}
@injectable()
class SendForgotPasswordEmailService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('MailProvider')
    private mailProvider: IMailProvider,

    @inject('UserTokensRepository')
    private userTokensRepository: IUserTokensRepository,

    @inject(BrandingService)
    private branding: BrandingService,
  ) {}

  public async execute({ email }: IRequest): Promise<void> {
    const user = await this.usersRepository.findByEmail(email);

    if (!user) {
      throw new AppError('Usuário não encontrado.');
    }

    const { token } = await this.userTokensRepository.generate(user.id);

    const forgotPasswordTemplate = path.resolve(
      __dirname,
      '..',
      'views',
      'forgot_password.hbs',
    );

    const brand = await this.branding.get();

    await this.mailProvider.sendMail({
      from: { name: `Equipe ${brand.name}`, email: 'equipe@gobarber.com.br' },
      to: {
        name: user.name,
        email: user.email,
      },
      subject: `[${brand.name}] Recuperação de senha`,
      templateData: {
        file: forgotPasswordTemplate,
        variables: {
          shopName: brand.name,
          name: user.name,
          link: `${process.env.APP_WEB_URL}/barbeiro/redefinir-senha?token=${token}`,
        },
      },
    });
  }
}

export default SendForgotPasswordEmailService;
