import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

// Motivo que pode ser escolhido ao bloquear um horário (ex: Almoço, Férias).
// O bloqueio guarda o nome do momento em que foi criado: renomear ou excluir
// um motivo não altera os bloqueios já feitos
@Entity('block_reasons')
class BlockReason {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default BlockReason;
