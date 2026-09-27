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
import Client from '../../../../clients/infra/typeorm/entities/Client';
import Service from '@modules/catalog/infra/typeorm/entities/Service';

@Entity('appointments')
class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  provider_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'provider_id' })
  provider: User;

  @Column()
  client_id: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  // null em agendamentos anteriores ao cadastro de serviços
  @Column({ type: 'uuid', nullable: true })
  service_id: string | null;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'service_id' })
  service: Service | null;

  // Valor do serviço no momento da marcação (em centavos)
  @Column({ type: 'int', nullable: true })
  price_cents: number | null;

  // Início do atendimento
  @Column('timestamp with time zone')
  date: Date;

  // Fim do atendimento: início + duração do serviço
  @Column('timestamp with time zone')
  end_date: Date;

  // Fim + intervalo entre atendimentos: até aqui o barbeiro fica ocupado
  @Column('timestamp with time zone')
  blocked_until: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default Appointment;
