import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import uploadConfig from '@config/upload';

import { Exclude, Expose } from 'class-transformer';
import { apiUrl } from '@shared/tenancy/hosts';
import { IAddress } from '@shared/utils/documents';
import { Permission } from '../../../permissions';
import Role from './Role';

@Entity('users')
class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  avatar: string;

  // Perfil de acesso, opcional: um conjunto de permissões pronto
  @Column({ type: 'uuid', nullable: true })
  role_id: string | null;

  @ManyToOne(() => Role, { eager: true, nullable: true })
  @JoinColumn({ name: 'role_id' })
  role: Role | null;

  // Permissões dadas só a este usuário (somam às do perfil)
  @Column('text', { name: 'permissions', array: true, default: '{}' })
  @Exclude()
  own_permissions: Permission[];

  // Senha provisória (o e-mail): troca obrigatória no próximo acesso
  @Column({ default: false })
  must_change_password: boolean;

  // Atende clientes: aparece na agenda e no agendamento do site
  @Column({ default: false })
  is_barber: boolean;

  // Telefone de contato
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  // Só os números
  @Column({ type: 'varchar', nullable: true })
  cpf: string | null;

  // 'yyyy-MM-dd'
  @Column({ type: 'date', nullable: true })
  birth_date: string | null;

  // CEP, rua, número, complemento, bairro, cidade e UF
  @Column({ type: 'jsonb', nullable: true })
  address: IAddress | null;

  // false = desativado pelo administrador (ver AddActiveToUsers)
  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  get isAdmin(): boolean {
    return !!this.role?.isAdmin;
  }

  // O que a pessoa pode fazer: as do perfil mais as próprias
  get allowed(): Permission[] {
    return Array.from(
      new Set([...(this.role?.allowed || []), ...(this.own_permissions || [])]),
    );
  }

  @Expose({ name: 'is_admin' })
  exposeIsAdmin(): boolean {
    return this.isAdmin;
  }

  @Expose({ name: 'permissions' })
  exposePermissions(): Permission[] {
    return this.allowed;
  }

  @Expose({ name: 'own_permissions' })
  exposeOwnPermissions(): Permission[] {
    return this.own_permissions || [];
  }

  public can(permission: Permission): boolean {
    return this.allowed.includes(permission);
  }

  @Expose({ name: 'avatar_url' })
  getAvatarUrl(): string | null {
    if (!this.avatar) {
      return `${apiUrl()}/files/defaultAvatar.jpeg`;
    }

    switch (uploadConfig.driver) {
      case 'disk':
        return `${apiUrl()}/files/${this.avatar}`;
      case 's3':
        return `https://${uploadConfig.config.aws.bucket}.s3.amazonaws.com/${this.avatar}`;
      default:
        return null;
    }
  }
}

export default User;
