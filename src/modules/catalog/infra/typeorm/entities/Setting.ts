import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Configurações gerais da barbearia, no formato chave/valor
@Entity('settings')
class Setting {
  @PrimaryColumn()
  key: string;

  @Column()
  value: string;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default Setting;
