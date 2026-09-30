// Sem entidades do TypeORM (que carregam o polyfill), o tsyringe precisa dele
import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import WhatsAppMessage, {
  MessageKind,
} from '../infra/typeorm/entities/WhatsAppMessage';
import IWhatsAppMessagesRepository from '../repositories/IWhatsAppMessagesRepository';
import WhatsAppSettingsService, {
  GROUP_OF,
  IActiveWhatsApp,
} from './WhatsAppSettingsService';

// Tentativas de envio automático antes de desistir
export const MAX_ATTEMPTS = 3;
// Histórico mostrado na tela
const HISTORY_LIMIT = 100;

interface IEnqueue {
  kind: MessageKind;
  client: { id: string | null; name: string; phone: string | null };
  body: string;
  // Mesma chave = mesma mensagem (não repete)
  dedupe_key: string;
  expires_at: Date | null;
}

export interface IMessageView {
  id: string;
  kind: MessageKind;
  client_id: string | null;
  client_name: string;
  phone: string | null;
  body: string;
  status: WhatsAppMessage['status'];
  provider: string;
  error: string | null;
  created_at: Date;
  sent_at: Date | null;
  expires_at: Date | null;
  // Envio assistido: abre o WhatsApp com a mensagem pronta
  wa_link: string | null;
}

// Telefone no formato do WhatsApp (55 + DDD + número); null = inválido.
// Os cadastros guardam só os dígitos, com DDD (10 ou 11)
export function toWhatsAppNumber(raw: string | null): string | null {
  const digits = (raw || '').replace(/\D/g, '');

  if (digits.startsWith('55') && [12, 13].includes(digits.length)) {
    return digits;
  }

  if ([10, 11].includes(digits.length)) return `55${digits}`;

  return null;
}

export function view(message: WhatsAppMessage): IMessageView {
  return {
    id: message.id,
    kind: message.kind,
    client_id: message.client_id,
    client_name: message.client_name,
    phone: message.phone,
    body: message.body,
    status: message.status,
    provider: message.provider,
    error: message.error,
    created_at: message.created_at,
    sent_at: message.sent_at,
    expires_at: message.expires_at,
    wa_link: message.phone
      ? `https://wa.me/${message.phone}?text=${encodeURIComponent(
          message.body,
        )}`
      : null,
  };
}

// Fila das mensagens de WhatsApp: cria (sem repetir), envia na hora quando o
// provedor é automático e, no envio assistido, espera alguém enviar pela tela
@injectable()
class WhatsAppService {
  constructor(
    @inject('WhatsAppMessagesRepository')
    private messagesRepository: IWhatsAppMessagesRepository,

    @inject(WhatsAppSettingsService)
    private settings: WhatsAppSettingsService,
  ) {}

  // null: WhatsApp desligado, grupo desligado ou mensagem repetida
  public async enqueue({
    kind,
    client,
    body,
    dedupe_key,
    expires_at,
  }: IEnqueue): Promise<WhatsAppMessage | null> {
    const active = await this.settings.active();

    if (!active || !active.groups.includes(GROUP_OF[kind])) return null;

    const phone = toWhatsAppNumber(client.phone);
    const message = await this.messagesRepository.create({
      kind,
      client_id: client.id,
      client_name: client.name,
      phone,
      body,
      // Sem telefone válido fica no histórico, para a barbearia corrigir
      status: phone ? 'pending' : 'skipped',
      error: phone ? null : 'Telefone sem DDD ou inválido.',
      provider: active.provider.key,
      dedupe_key,
      expires_at,
    });

    if (!message) return null;

    if (phone && active.provider.automatic) {
      return this.deliver(message, active);
    }

    return message;
  }

  // O WhatsApp alcança este cliente com este grupo de mensagem?
  public async reaches(
    phone: string | null,
    kind: MessageKind,
  ): Promise<boolean> {
    const active = await this.settings.active();

    return (
      !!active &&
      active.groups.includes(GROUP_OF[kind]) &&
      !!toWhatsAppNumber(phone)
    );
  }

  public async pending(): Promise<IMessageView[]> {
    return (
      await this.messagesRepository.findPending(new Date(Date.now()))
    ).map(view);
  }

  public async history(): Promise<IMessageView[]> {
    return (await this.messagesRepository.findHistory(HISTORY_LIMIT)).map(view);
  }

  public async countPending(): Promise<number> {
    return this.messagesRepository.countPending(new Date(Date.now()));
  }

  // Envio assistido: a barbearia enviou pelo WhatsApp
  public async markSent(id: string, user_id: string): Promise<IMessageView> {
    const message = await this.find(id);

    if (message.status !== 'pending' && message.status !== 'failed') {
      throw new AppError('Esta mensagem já saiu da fila.');
    }

    Object.assign(message, {
      status: 'sent',
      sent_at: new Date(Date.now()),
      handled_by: user_id,
      error: null,
    });

    return view(await this.messagesRepository.save(message));
  }

  public async skip(id: string, user_id: string): Promise<IMessageView> {
    const message = await this.find(id);

    if (message.status !== 'pending' && message.status !== 'failed') {
      throw new AppError('Esta mensagem já saiu da fila.');
    }

    Object.assign(message, {
      status: 'skipped',
      handled_by: user_id,
      error: 'Pulada pela barbearia.',
    });

    return view(await this.messagesRepository.save(message));
  }

  // Tarefa periódica: vence as que perderam o sentido e tenta de novo as
  // falhas do envio automático
  public async maintain(): Promise<{ expired: number; retried: number }> {
    const now = new Date(Date.now());
    const expired = await this.messagesRepository.expire(now);
    const active = await this.settings.active();

    if (!active || !active.provider.automatic) return { expired, retried: 0 };

    const failed = await this.messagesRepository.findRetryable(
      MAX_ATTEMPTS,
      now,
    );

    // eslint-disable-next-line no-restricted-syntax
    for (const message of failed) {
      // eslint-disable-next-line no-await-in-loop
      await this.deliver(message, active);
    }

    return { expired, retried: failed.length };
  }

  private async deliver(
    message: WhatsAppMessage,
    active: IActiveWhatsApp,
  ): Promise<WhatsAppMessage> {
    Object.assign(message, {
      attempts: message.attempts + 1,
      provider: active.provider.key,
    });

    try {
      const { external_id } = await active.provider.send(active.credentials, {
        to: message.phone as string,
        body: message.body,
      });

      Object.assign(message, {
        status: 'sent',
        external_id,
        sent_at: new Date(Date.now()),
        error: null,
      });
    } catch (err) {
      Object.assign(message, {
        status: 'failed',
        error:
          err instanceof AppError
            ? err.message
            : 'O provedor não respondeu. Nova tentativa em alguns minutos.',
      });
    }

    return this.messagesRepository.save(message);
  }

  private async find(id: string): Promise<WhatsAppMessage> {
    const message = await this.messagesRepository.findById(id);

    if (!message) {
      throw new AppError('Mensagem não encontrada.', 404);
    }

    return message;
  }
}

export default WhatsAppService;
