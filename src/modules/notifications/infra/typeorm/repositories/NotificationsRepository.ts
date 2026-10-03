import { MongoRepository } from 'typeorm';
import { ObjectId } from 'mongodb';

import mongoDataSource from '@shared/infra/typeorm/mongoDataSource';
import { requireTenant } from '@shared/tenancy/TenantContext';

import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import ICreateNotificationDTO from '@modules/notifications/dtos/ICreateNotificationDTO';

import Notification from '../schemas/Notification';

// Não lida: read false ou ausente (notificações criadas antes do campo)
const UNREAD = { read: { $ne: true } };

// O MongoDB não tem o isolamento do Postgres: toda consulta leva a
// barbearia atual no filtro
function scope(): { tenant_id: string } {
  return { tenant_id: requireTenant().id };
}

class NotificationsRepository implements INotificationsRepository {
  private ormRepository: MongoRepository<Notification>;

  constructor() {
    this.ormRepository = mongoDataSource.getMongoRepository(Notification);
  }

  public async create({
    content,
    recipient_id,
    date,
  }: ICreateNotificationDTO): Promise<Notification> {
    const notification = this.ormRepository.create({
      ...scope(),
      content,
      recipient_id,
      read: false,
      ...(date && { date }),
    });

    await this.ormRepository.save(notification);

    return notification;
  }

  public async findByRecipient(
    recipient_id: string,
    { limit, only_unread }: { limit: number; only_unread: boolean },
  ): Promise<Notification[]> {
    return this.ormRepository.find({
      where: { ...scope(), recipient_id, ...(only_unread && UNREAD) },
      order: { _id: 'DESC' },
      take: limit,
    } as object);
  }

  public async countUnread(recipient_id: string): Promise<number> {
    return this.ormRepository.count({ ...scope(), recipient_id, ...UNREAD });
  }

  public async markAsRead(id: string, recipient_id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;

    const result = await this.ormRepository.updateOne(
      { ...scope(), _id: new ObjectId(id), recipient_id },
      { $set: { read: true, updated_at: new Date() } },
    );

    return result.matchedCount > 0;
  }

  public async markAllAsRead(recipient_id: string): Promise<void> {
    await this.ormRepository.updateMany(
      { ...scope(), recipient_id, ...UNREAD },
      { $set: { read: true, updated_at: new Date() } },
    );
  }

  public async removeAll(): Promise<void> {
    await this.ormRepository.deleteMany(scope());
  }
}
export default NotificationsRepository;
