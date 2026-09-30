import { injectable, inject } from 'tsyringe';

import IWhatsAppProvider from './models/IWhatsAppProvider';

// Provedores que ainda vão ganhar implementação. Aparecem na tela como
// "em breve"; ao implementar, o provedor sai daqui e entra no construtor
export const UPCOMING_WHATSAPP: Array<{ key: string; label: string }> = [
  { key: 'meta', label: 'API oficial do WhatsApp (Meta Cloud API)' },
  { key: 'twilio', label: 'Twilio' },
];

// Formas de enviar WhatsApp disponíveis no sistema
@injectable()
export default class WhatsAppRegistry {
  private providers: IWhatsAppProvider[];

  constructor(
    @inject('ManualWhatsAppProvider')
    manual: IWhatsAppProvider,

    @inject('SimulatorWhatsAppProvider')
    simulator: IWhatsAppProvider,
  ) {
    this.providers = [manual, simulator];
  }

  public list(): IWhatsAppProvider[] {
    return this.providers;
  }

  public upcoming(): Array<{ key: string; label: string }> {
    return UPCOMING_WHATSAPP.filter(item => !this.get(item.key));
  }

  public get(key: string): IWhatsAppProvider | undefined {
    return this.providers.find(provider => provider.key === key);
  }
}
