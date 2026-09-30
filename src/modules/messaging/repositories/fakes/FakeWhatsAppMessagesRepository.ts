import { randomUUID } from 'crypto';

import IWhatsAppMessagesRepository, {
  ICreateWhatsAppMessageDTO,
} from '../IWhatsAppMessagesRepository';
import WhatsAppMessage from '../../infra/typeorm/entities/WhatsAppMessage';

const isValid = (message: WhatsAppMessage, now: Date): boolean =>
  !message.expires_at || message.expires_at > now;

class FakeWhatsAppMessagesRepository implements IWhatsAppMessagesRepository {
  public messages: WhatsAppMessage[] = [];

  public async create(
    data: ICreateWhatsAppMessageDTO,
  ): Promise<WhatsAppMessage | undefined> {
    if (
      data.dedupe_key &&
      this.messages.some(item => item.dedupe_key === data.dedupe_key)
    ) {
      return undefined;
    }

    const message = Object.assign(new WhatsAppMessage(), data, {
      id: randomUUID(),
      attempts: 0,
      external_id: null,
      sent_at: null,
      handled_by: null,
      created_at: new Date(Date.now()),
      updated_at: new Date(Date.now()),
    });

    this.messages.push(message);

    return message;
  }

  public async save(message: WhatsAppMessage): Promise<WhatsAppMessage> {
    const index = this.messages.findIndex(item => item.id === message.id);

    this.messages[index] = Object.assign(message, {
      updated_at: new Date(Date.now()),
    });

    return message;
  }

  public async findById(id: string): Promise<WhatsAppMessage | undefined> {
    return this.messages.find(message => message.id === id);
  }

  public async findPending(now: Date): Promise<WhatsAppMessage[]> {
    return this.messages.filter(
      message => message.status === 'pending' && isValid(message, now),
    );
  }

  public async countPending(now: Date): Promise<number> {
    return (await this.findPending(now)).length;
  }

  public async findHistory(limit: number): Promise<WhatsAppMessage[]> {
    return this.messages
      .filter(message => message.status !== 'pending')
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
      .slice(0, limit);
  }

  public async findRetryable(
    maxAttempts: number,
    now: Date,
  ): Promise<WhatsAppMessage[]> {
    return this.messages.filter(
      message =>
        message.status === 'failed' &&
        message.attempts < maxAttempts &&
        isValid(message, now),
    );
  }

  public async expire(now: Date): Promise<number> {
    const due = this.messages.filter(
      message =>
        (message.status === 'pending' || message.status === 'failed') &&
        !isValid(message, now),
    );

    due.forEach(message => Object.assign(message, { status: 'expired' }));

    return due.length;
  }
}

export default FakeWhatsAppMessagesRepository;
