import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import User from '@modules/users/infra/typeorm/entities/User';
import Service from '@modules/catalog/infra/typeorm/entities/Service';
import Client from '../../../../clients/infra/typeorm/entities/Client';

// Parte do dia em que o cliente pode vir
export type WaitlistPeriod = 'any' | 'morning' | 'afternoon' | 'evening';

// Cliente esperando abrir um horário num dia lotado
@Entity('waitlist_entries')
class WaitlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  client_id: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  // Dia desejado, 'yyyy-MM-dd'
  @Column({ type: 'date' })
  date: string;

  // null = qualquer barbeiro
  @Column({ type: 'uuid', nullable: true })
  provider_id: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'provider_id' })
  provider: User | null;

  // null = serviço não informado
  @Column({ type: 'uuid', nullable: true })
  service_id: string | null;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'service_id' })
  service: Service | null;

  @Column({ type: 'varchar', default: 'any' })
  period: WaitlistPeriod;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  // Quem colocou na lista
  @Column({ type: 'varchar' })
  created_by: 'provider' | 'client';

  // Barbeiro que colocou (null quando foi o próprio cliente)
  @Column({ type: 'uuid', nullable: true })
  created_by_user: string | null;

  // 'removed': tirado da lista (pela barbearia ou pelo cliente)
  @Column({ type: 'varchar', default: 'waiting' })
  status: 'waiting' | 'removed';

  // Último aviso de horário liberado
  @Column({ type: 'timestamp with time zone', nullable: true })
  notified_at: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default WaitlistEntry;
