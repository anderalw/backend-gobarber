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
import Service from '@modules/catalog/infra/typeorm/entities/Service';
import { PaymentMethod } from '@modules/appointments/infra/typeorm/entities/Appointment';

// Pacote de sessões vendido ao cliente: os agendamentos desse serviço ficam
// inclusos (preço 0) até acabarem as sessões
@Entity('session_packages')
class SessionPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  client_id: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column('uuid')
  service_id: string;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'service_id' })
  service: Service;

  // Quantas sessões o pacote cobre
  @Column('int')
  sessions: number;

  // Valor pago pelo pacote (entra no caixa do dia da venda)
  @Column('int')
  price_cents: number;

  @Column({ type: 'varchar' })
  payment_method: PaymentMethod;

  @Column({ type: 'timestamp with time zone' })
  paid_at: Date;

  @Column({ type: 'uuid', nullable: true })
  received_by: string | null;

  // Cancelado: deixa de cobrir novos horários
  @Column({ type: 'timestamp with time zone', nullable: true })
  canceled_at: Date | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default SessionPackage;
