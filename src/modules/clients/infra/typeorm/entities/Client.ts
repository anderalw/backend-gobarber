import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity('clients')
class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // null quando o barbeiro cadastrou sem e-mail
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  // null até o cliente criar a conta no site (cadastro feito pelo barbeiro)
  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  password: string | null;

  @Column()
  phone: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default Client;
