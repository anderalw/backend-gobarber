import { randomUUID } from 'crypto';

import IWhatsAppProvider, {
  IWhatsAppCredentialField,
} from '../models/IWhatsAppProvider';

interface ISimulatedMessage {
  external_id: string;
  to: string;
  body: string;
  sent_at: Date;
}

// Até quantas mensagens o simulador guarda na memória
const LIMIT = 200;

// Envio automático de mentira, para testar sem conta em provedor: as
// mensagens "saem" na hora e ficam só na memória do servidor
export default class SimulatorWhatsAppProvider implements IWhatsAppProvider {
  public readonly key = 'simulator';

  public readonly label = 'Simulador (testes)';

  public readonly description =
    'Finge o envio automático: as mensagens aparecem como enviadas, sem sair de verdade. Serve para ver o fluxo antes de ligar a API oficial.';

  public readonly automatic = true;

  public readonly credentialFields: IWhatsAppCredentialField[] = [];

  public outbox: ISimulatedMessage[] = [];

  public async verify(): Promise<void> {
    // Nada a conectar
  }

  public async send(
    _credentials: Record<string, string>,
    { to, body }: { to: string; body: string },
  ): Promise<{ external_id: string }> {
    const message = {
      external_id: `sim_${randomUUID()}`,
      to,
      body,
      sent_at: new Date(Date.now()),
    };

    this.outbox = [message, ...this.outbox].slice(0, LIMIT);

    return { external_id: message.external_id };
  }
}
