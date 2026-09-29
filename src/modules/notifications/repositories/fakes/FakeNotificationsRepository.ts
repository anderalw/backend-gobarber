import { ObjectId } from 'mongodb';

import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import ICreateNotificationDTO from '@modules/notifications/dtos/ICreateNotificationDTO';

import Notification from '../../infra/typeorm/schemas/Notification';

class NotificationsRepository implements INotificationsRepository {
  private notifications: Notification[] = [];

  public async create({
    content,
    recipient_id,
    date,
  }: ICreateNotificationDTO): Promise<Notification> {
    const notification = new Notification();

    Object.assign(notification, {
      id: new ObjectId(),
      content,
      recipient_id,
      read: false,
      date,
      create_at: new Date(),
    });

    this.notifications.push(notification);

    return notification;
  }

  public async findByRecipient(
    recipient_id: string,
    { limit, only_unread }: { limit: number; only_unread: boolean },
  ): Promise<Notification[]> {
    return this.notifications
      .filter(
        item =>
          item.recipient_id === recipient_id && (!only_unread || !item.read),
      )
      .reverse()
      .slice(0, limit);
  }

  public async countUnread(recipient_id: string): Promise<number> {
    return this.notifications.filter(
      item => item.recipient_id === recipient_id && !item.read,
    ).length;
  }

  public async markAsRead(id: string, recipient_id: string): Promise<boolean> {
    const notification = this.notifications.find(
      item =>
        item.id.toHexString() === id && item.recipient_id === recipient_id,
    );

    if (!notification) return false;

    notification.read = true;

    return true;
  }

  public async markAllAsRead(recipient_id: string): Promise<void> {
    this.notifications
      .filter(item => item.recipient_id === recipient_id)
      .forEach(item => {
        // eslint-disable-next-line no-param-reassign
        item.read = true;
      });
  }
}
export default NotificationsRepository;
