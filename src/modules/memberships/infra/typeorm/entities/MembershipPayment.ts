import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { PaymentMethod } from '@modules/appointments/infra/typeorm/entities/Appointment';
import Membership from './Membership';

// Mensalidade recebida (entra no caixa do dia)
@Entity('membership_payments')
class MembershipPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  membership_id: string;

  @ManyToOne(() => Membership)
  @JoinColumn({ name: 'membership_id' })
  membership: Membership;

  @Column('int')
  amount_cents: number;

  @Column({ type: 'varchar' })
  payment_method: PaymentMethod;

  // Mês coberto: [period_start, period_end) ('yyyy-MM-dd')
  @Column({ type: 'date' })
  period_start: string;

  @Column({ type: 'date' })
  period_end: string;

  @Column({ type: 'timestamp with time zone' })
  paid_at: Date;

  @Column({ type: 'uuid', nullable: true })
  received_by: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default MembershipPayment;
