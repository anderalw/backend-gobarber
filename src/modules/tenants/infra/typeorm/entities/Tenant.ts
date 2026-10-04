import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TenantStatus = 'active' | 'suspended';

// Uma barbearia cliente do Pontual. Tudo o mais no banco pertence a uma
@Entity('tenants')
class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Subdomínio: <slug>.<BASE_DOMAIN>
  @Column()
  slug: string;

  @Column()
  name: string;

  // Domínio próprio (ex.: barbeariadoze.com.br), opcional
  @Column({ type: 'varchar', nullable: true })
  custom_domain: string | null;

  @Column({ type: 'varchar', default: 'active' })
  status: TenantStatus;

  // Ramo de negócio (modules/tenants/segments): definido na criação
  @Column({ type: 'varchar', default: 'barbershop' })
  segment: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}

export default Tenant;
