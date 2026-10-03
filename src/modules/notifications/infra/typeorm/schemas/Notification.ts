import {
  ObjectId,
  Entity,
  Column,
  ObjectIdColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('Notifications')
class Notification {
  @ObjectIdColumn()
  id: ObjectId;

  @Column()
  content: string;

  // Barbearia dona da notificação
  @Column('uuid')
  tenant_id: string;

  @Column('uuid')
  recipient_id: string;

  // Nas notificações antigas o campo não existe: conta como não lida
  @Column({ default: false })
  read: boolean;

  // Data do agendamento citado (ausente nas notificações antigas)
  @Column({ nullable: true })
  date?: Date;

  @CreateDateColumn()
  create_at: Date;

  @CreateDateColumn()
  updated_at: Date;
}

export default Notification;
