import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import Client from '@modules/clients/infra/typeorm/entities/Client';
import MembershipPlan from './MembershipPlan';

// 'pending': pedido pelo site, esperando a barbearia confirmar
export type MembershipStatus = 'pending' | 'active' | 'canceled';

// Assinatura de um cliente
@Entity('memberships')
class Membership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  client_id: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column('uuid')
  plan_id: string;

  @ManyToOne(() => MembershipPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: MembershipPlan;

  @Column({ type: 'varchar' })
  status: MembershipStatus;

  // Início dos ciclos mensais do saldo ('yyyy-MM-dd')
  @Column({ type: 'date', nullable: true })
  cycle_anchor: string | null;

  // Pago até, exclusivo ('yyyy-MM-dd')
  @Column({ type: 'date', nullable: true })
  paid_until: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  requested_at: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  canceled_at: Date | null;

  // Quem cadastrou ou confirmou na barbearia
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default Membership;
