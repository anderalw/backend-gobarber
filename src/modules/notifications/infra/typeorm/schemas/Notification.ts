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

  @Column('uuid')
  recipient_id: string;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  create_at: Date;

  @CreateDateColumn()
  updated_at: Date;
}

export default Notification;
