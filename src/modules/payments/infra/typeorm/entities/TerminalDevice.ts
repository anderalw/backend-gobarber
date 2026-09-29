import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Maquininha cadastrada pela barbearia
@Entity('terminal_devices')
class TerminalDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Operadora ('simulator', 'mercadopago'...)
  @Column()
  provider: string;

  // Id do aparelho na operadora (número de série, por exemplo)
  @Column()
  external_id: string;

  @Column()
  name: string;

  // Desativada: some da tela de cobrança, mas continua cadastrada
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default TerminalDevice;
