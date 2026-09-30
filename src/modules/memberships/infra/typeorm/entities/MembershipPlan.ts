import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Um serviço incluído no plano; quantity null = ilimitado no mês
export interface IPlanItem {
  service_id: string;
  quantity: number | null;
}

// Plano do clube de assinatura
@Entity('membership_plans')
class MembershipPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  // Mensalidade
  @Column('int')
  price_cents: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  items: IPlanItem[];

  // Dias mínimos entre dois usos do mesmo serviço (null = livre)
  @Column({ type: 'int', nullable: true })
  min_interval_days: number | null;

  // Dias da semana em que o plano vale (0 = domingo); null = todos
  @Column({ type: 'jsonb', nullable: true })
  weekdays: number[] | null;

  // Desconto nos serviços fora do plano (0 a 100)
  @Column({ type: 'int', default: 0 })
  discount_percent: number;

  // Inativo: não aceita novas assinaturas (as atuais continuam)
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default MembershipPlan;
