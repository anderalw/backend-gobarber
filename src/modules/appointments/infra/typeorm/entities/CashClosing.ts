import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PaymentMethod } from './Appointment';

export type PaymentTotals = Record<
  PaymentMethod | 'unknown',
  { count: number; cents: number }
>;

// Fechamento do caixa de um dia. Pode ser refeito (fica o último)
@Entity('cash_closings')
class CashClosing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 'yyyy-MM-dd'
  @Column({ type: 'date', unique: true })
  date: string;

  // Fundo de troco no começo do dia
  @Column('int')
  opening_cents: number;

  // Dinheiro contado na gaveta ao fechar
  @Column('int')
  counted_cents: number;

  // Fundo de troco + recebido em dinheiro
  @Column('int')
  expected_cash_cents: number;

  // Total recebido no dia (todas as formas)
  @Column('int')
  received_cents: number;

  @Column({ type: 'jsonb' })
  totals: PaymentTotals;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  closed_by: string | null;

  @Column({ type: 'timestamp with time zone' })
  closed_at: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default CashClosing;
