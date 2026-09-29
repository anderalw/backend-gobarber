import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import User from '@modules/users/infra/typeorm/entities/User';

// Período em que o barbeiro não atende, fora da folga semanal: almoço,
// consulta, férias. Ninguém consegue agendar com ele nesse intervalo
@Entity('time_blocks')
class TimeBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  provider_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'provider_id' })
  provider: User;

  @Column('timestamp with time zone')
  start_date: Date;

  @Column('timestamp with time zone')
  end_date: Date;

  // Opcional, aparece só para a equipe na agenda
  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  // Barbeiro que criou o bloqueio
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}

export default TimeBlock;
