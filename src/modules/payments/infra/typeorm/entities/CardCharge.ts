import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ChargeStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'canceled'
  | 'expired';

export type ChargeMethod = 'credit' | 'debit' | 'pix';

// Uma tentativa de cobrar um atendimento na maquininha de cartão
@Entity('card_charges')
class CardCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  appointment_id: string;

  // Operadora ('simulator', 'mercadopago'...)
  @Column()
  provider: string;

  @Column()
  device_id: string;

  @Column()
  device_name: string;

  // Id da cobrança na operadora
  @Column({ type: 'varchar', nullable: true })
  external_id: string | null;

  @Column('int')
  amount_cents: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: ChargeStatus;

  @Column({ type: 'varchar', nullable: true })
  method: ChargeMethod | null;

  // Motivo da recusa (ou outra mensagem da operadora)
  @Column({ type: 'varchar', nullable: true })
  message: string | null;

  // Barbeiro que mandou cobrar
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  resolved_at: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default CardCharge;
