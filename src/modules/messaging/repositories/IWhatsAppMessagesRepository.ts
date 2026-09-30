import WhatsAppMessage from '../infra/typeorm/entities/WhatsAppMessage';

export type ICreateWhatsAppMessageDTO = Pick<
  WhatsAppMessage,
  | 'kind'
  | 'client_id'
  | 'client_name'
  | 'phone'
  | 'body'
  | 'status'
  | 'provider'
  | 'dedupe_key'
  | 'expires_at'
  | 'error'
>;

export default interface IWhatsAppMessagesRepository {
  // undefined: já existe uma mensagem com a mesma dedupe_key
  create(data: ICreateWhatsAppMessageDTO): Promise<WhatsAppMessage | undefined>;
  save(message: WhatsAppMessage): Promise<WhatsAppMessage>;
  findById(id: string): Promise<WhatsAppMessage | undefined>;
  // Esperando envio e ainda válidas, das mais antigas para as mais novas
  findPending(now: Date): Promise<WhatsAppMessage[]>;
  countPending(now: Date): Promise<number>;
  // As que já saíram da fila (enviadas, puladas, falhas...), das mais novas
  findHistory(limit: number): Promise<WhatsAppMessage[]>;
  // Falhas automáticas que ainda podem ser tentadas de novo
  findRetryable(maxAttempts: number, now: Date): Promise<WhatsAppMessage[]>;
  // Pendentes que passaram do prazo viram 'expired'; devolve quantas
  expire(now: Date): Promise<number>;
}
