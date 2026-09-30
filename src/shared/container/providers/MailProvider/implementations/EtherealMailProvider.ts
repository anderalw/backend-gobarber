import nodemailer, { Transporter } from 'nodemailer';
import { inject, injectable } from 'tsyringe';
import mailConfig from '@config/mail';
import IMailTemplateProvider from '@shared/container/providers/MailTemplateProvider/models/IMailTemplateProvider';
import IMailProvider from '../models/IMailProvider';
import ISendMailDTO from '../dtos/iSendMailDTO';

@injectable()
export default class EtherealMailProvider implements IMailProvider {
  // A conta de teste é criada ao subir o servidor; os envios feitos antes
  // disso esperam por ela
  private client: Promise<Transporter>;

  constructor(
    @inject('MailTemplateProvider')
    private mailTemplateProvider: IMailTemplateProvider,
  ) {
    this.client = nodemailer.createTestAccount().then(account =>
      nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
          user: account.user,
          pass: account.pass,
        },
      }),
    );

    // Sem internet a conta não é criada: o servidor continua no ar e cada
    // envio falha (quem envia registra o erro)
    this.client.catch(() => undefined);
  }

  public async sendMail({
    to,
    from,
    subject,
    templateData,
  }: ISendMailDTO): Promise<void> {
    const client = await this.client;

    const message = await client.sendMail({
      from: {
        name: from?.name || mailConfig.defaults.from.name,
        address: from?.email || mailConfig.defaults.from.email,
      },
      to: {
        name: to.name,
        address: to.email,
      },
      subject,
      html: await this.mailTemplateProvider.parse(templateData),
    });
    console.log('Message sent: %s', message.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(message));
  }
}
