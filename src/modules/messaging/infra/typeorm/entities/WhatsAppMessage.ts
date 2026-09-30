import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MessageKind =
  | 'reminder'
  | 'appointment_created'
  | 'appointment_rescheduled'
  | 'appointment_canceled'
  | 'series_created'
  | 'series_canceled'
  | 'waitlist_slot'
  | 'membership_due'
  | 'membership_overdue';

// pending: esperando o envio assistido (ou nova tentativa automática)
export type MessageStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'expired';

// Mensagem de WhatsApp para um cliente
@Entity('whatsapp_messages')
class WhatsAppMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  kind: MessageKind;

  @Column({ type: 'uuid', nullable: true })
  client_id: string | null;

  @Column()
  client_name: string;

  // Com código do país (5511999990000); null = telefone inválido
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column('text')
  body: string;

  @Column({ type: 'varchar' })
  status: MessageStatus;

  // Modo de envio ('manual', 'simulator', 'meta'...)
  @Column()
  provider: string;

  @Column({ type: 'varchar', nullable: true })
  dedupe_key: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  // Motivo da falha ou de ter sido pulada
  @Column({ type: 'varchar', nullable: true })
  error: string | null;

  @Column({ type: 'varchar', nullable: true })
  external_id: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  handled_by: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default WhatsAppMessage;
