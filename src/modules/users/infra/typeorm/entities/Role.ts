import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Exclude, Expose } from 'class-transformer';

import { ADMIN_ROLE, ALL_PERMISSIONS, Permission } from '../../../permissions';

// Perfil de acesso da equipe (Administrador, Recepção, Barbeiro...): o
// conjunto de permissões que os usuários dele têm
@Entity('roles')
class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text', { name: 'permissions', array: true, default: '{}' })
  @Exclude()
  stored_permissions: Permission[];

  // Perfis criados com a barbearia ('admin', 'reception', 'barber'); null
  // nos criados pelo administrador
  @Column({ type: 'varchar', nullable: true })
  system_key: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  // O administrador pode tudo, inclusive o que for criado depois
  get isAdmin(): boolean {
    return this.system_key === ADMIN_ROLE;
  }

  get allowed(): Permission[] {
    return this.isAdmin ? [...ALL_PERMISSIONS] : this.stored_permissions || [];
  }

  @Expose({ name: 'is_admin' })
  exposeIsAdmin(): boolean {
    return this.isAdmin;
  }

  @Expose({ name: 'permissions' })
  exposePermissions(): Permission[] {
    return this.allowed;
  }
}

export default Role;
