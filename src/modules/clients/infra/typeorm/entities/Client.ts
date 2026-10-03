import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { IAddress } from '@shared/utils/documents';

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

  // Vazio só no primeiro login com Google (o cliente informa em seguida)
  @Column()
  phone: string;

  // Conta Google ligada (login com Google); null = só e-mail e senha
  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  google_id: string | null;

  // Só os números
  @Column({ type: 'varchar', nullable: true })
  cpf: string | null;

  // 'yyyy-MM-dd'
  @Column({ type: 'date', nullable: true })
  birth_date: string | null;

  // CEP, rua, número, complemento, bairro, cidade e UF
  @Column({ type: 'jsonb', nullable: true })
  address: IAddress | null;

  // Observações da barbearia (preferências, alergias...)
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default Client;
