import AppError from '@shared/errors/AppError';
import IWhatsAppProvider, {
  IWhatsAppCredentialField,
} from '../models/IWhatsAppProvider';

// Envio assistido: o sistema escreve a mensagem e alguém da barbearia envia
// com um clique, pelo WhatsApp do próprio computador ou celular (wa.me)
export default class ManualWhatsAppProvider implements IWhatsAppProvider {
  public readonly key = 'manual';

  public readonly label = 'Envio assistido (um clique por mensagem)';

  public readonly description =
    'As mensagens ficam na tela WhatsApp. Um clique abre o WhatsApp com o texto pronto para o cliente; é só enviar. Grátis e sem risco de bloqueio.';

  public readonly automatic = false;

  public readonly credentialFields: IWhatsAppCredentialField[] = [];

  public async verify(): Promise<void> {
    // Nada a conectar
  }

  public async send(): Promise<{ external_id: string }> {
    throw new AppError('No envio assistido, a mensagem é enviada pela tela.');
  }
}
