import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Serviço oferecido pela barbearia (ex: Cabelo, Barba, Cabelo e barba)
@Entity('services')
class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // Tempo que o agendamento ocupa na agenda
  @Column('int')
  duration_minutes: number;

  // Valor em centavos, para evitar erros de arredondamento
  @Column('int')
  price_cents: number;

  // Ordem em que aparece para os clientes (menor primeiro)
  @Column('int', { default: 0 })
  position: number;

  // Serviços desativados somem para os clientes, mas continuam no histórico
  @Column()
  active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default Service;
