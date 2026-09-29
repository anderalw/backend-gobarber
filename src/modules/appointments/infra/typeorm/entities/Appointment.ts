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

// Como terminou o atendimento: o cliente foi atendido ou faltou
export type Attendance = 'completed' | 'no_show';

@Entity('appointments')
class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  provider_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'provider_id' })
  provider: User;

  // null só em agendamentos antigos, anteriores ao cadastro de clientes
  @Column({ type: 'uuid', nullable: true })
  client_id: string | null;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client | null;

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

  // Preenchido ao cancelar: o agendamento some da agenda e libera o horário
  @Column({ type: 'timestamp with time zone', nullable: true })
  canceled_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  canceled_by: 'provider' | 'client' | null;

  // Registrado pelo barbeiro depois que o horário começa; null = a confirmar
  @Column({ type: 'varchar', nullable: true })
  attendance: Attendance | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  attendance_at: Date | null;

  // Barbeiro que registrou
  @Column({ type: 'uuid', nullable: true })
  attendance_by: string | null;

  // Link de confirmação enviado ao cliente na véspera
  @Column({ type: 'varchar', nullable: true })
  confirmation_token: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  confirmation_requested_at: Date | null;

  // Preenchido quando o cliente confirma pelo link (ou a barbearia registra)
  @Column({ type: 'timestamp with time zone', nullable: true })
  confirmed_at: Date | null;

  // Barbeiro que registrou a confirmação; null = o cliente, pelo link
  @Column({ type: 'uuid', nullable: true })
  confirmed_by: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default Appointment;
