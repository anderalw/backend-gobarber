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

  // Perfil de acesso (o que a pessoa pode fazer no sistema)
  @Column({ type: 'uuid', nullable: true })
  role_id: string | null;

  @ManyToOne(() => Role, { eager: true, nullable: true })
  @JoinColumn({ name: 'role_id' })
  role: Role | null;

  // Atende clientes: aparece na agenda e no agendamento do site
  @Column({ default: false })
  is_barber: boolean;

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

  get allowed(): Permission[] {
    return this.role?.allowed || [];
  }

  @Expose({ name: 'is_admin' })
  exposeIsAdmin(): boolean {
    return this.isAdmin;
  }

  @Expose({ name: 'permissions' })
  exposePermissions(): Permission[] {
    return this.allowed;
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
