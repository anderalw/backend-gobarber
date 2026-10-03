import ICreateNotificationDTO from '../dtos/ICreateNotificationDTO';
import Notification from '../infra/typeorm/schemas/Notification';

export default interface INotificationsRepository {
  create(data: ICreateNotificationDTO): Promise<Notification>;
  // As mais recentes primeiro
  findByRecipient(
    recipient_id: string,
    options: { limit: number; only_unread: boolean },
  ): Promise<Notification[]>;
  countUnread(recipient_id: string): Promise<number>;
  // false se a notificação não existe ou é de outra pessoa
  markAsRead(id: string, recipient_id: string): Promise<boolean>;
  markAllAsRead(recipient_id: string): Promise<void>;
  // Todas as da barbearia atual (ao excluir a barbearia)
  removeAll(): Promise<void>;
}
