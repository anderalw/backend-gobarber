import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import User from '@modules/users/infra/typeorm/entities/User';

// Bloqueio que se repete (ex: almoço todos os dias das 12:00 às 13:30), a
// partir de uma data e até outra, ou sem data de fim
@Entity('recurring_time_blocks')
class RecurringTimeBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  provider_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'provider_id' })
  provider: User;

  // 0 = domingo ... 6 = sábado
  @Column('int', { array: true })
  days_of_week: number[];

  // 'HH:mm'
  @Column()
  start_time: string;

  @Column()
  end_time: string;

  // 'yyyy-MM-dd'
  @Column('date')
  starts_on: string;

  // null = sem data de fim
  @Column({ type: 'date', nullable: true })
  ends_on: string | null;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}

export default RecurringTimeBlock;
