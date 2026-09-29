import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import INotificationsRepository from '../repositories/INotificationsRepository';

// Quantas notificações a tela mostra (as mais recentes)
export const NOTIFICATIONS_LIMIT = 50;

// Notificações antigas não guardam a data do agendamento, mas o texto traz
// "dd/MM/yyyy às HH:mm". Em "remarcado de X para Y" vale a última (a nova)
export function dateFromContent(content: string): Date | null {
  const matches = Array.from(
    content.matchAll(/(\d{2})\/(\d{2})\/(\d{4})(?: às (\d{2}):(\d{2}))?/g),
  );
  const last = matches[matches.length - 1];

  if (!last) return null;

  const [, day, month, year, hours = '0', minutes = '0'] = last;

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
  );
}

interface INotificationView {
  id: string;
  content: string;
  read: boolean;
  created_at: Date;
  // Dia do agendamento citado; null nas notificações antigas
  date: Date | null;
}

interface IListResponse {
  notifications: INotificationView[];
  unread: number;
}

// Notificações do barbeiro logado: listar, contar as não lidas e marcar
// como lidas. Cada um só vê e altera as próprias
@injectable()
class NotificationsService {
  constructor(
    @inject('NotificationsRepository')
    private notificationsRepository: INotificationsRepository,
  ) {}

  public async list(
    recipient_id: string,
    only_unread = false,
  ): Promise<IListResponse> {
    const [notifications, unread] = await Promise.all([
      this.notificationsRepository.findByRecipient(recipient_id, {
        limit: NOTIFICATIONS_LIMIT,
        only_unread,
      }),
      this.notificationsRepository.countUnread(recipient_id),
    ]);

    return {
      notifications: notifications.map(notification => ({
        id: notification.id.toHexString(),
        content: notification.content,
        read: notification.read === true,
        // Sem create_at gravado, usa a data de criação do ObjectId
        created_at: notification.create_at || notification.id.getTimestamp(),
        date: notification.date || dateFromContent(notification.content),
      })),
      unread,
    };
  }

  public async unreadCount(recipient_id: string): Promise<number> {
    return this.notificationsRepository.countUnread(recipient_id);
  }

  public async markAsRead(id: string, recipient_id: string): Promise<void> {
    const found = await this.notificationsRepository.markAsRead(
      id,
      recipient_id,
    );

    if (!found) {
      throw new AppError('Notificação não encontrada.', 404);
    }
  }

  public async markAllAsRead(recipient_id: string): Promise<void> {
    await this.notificationsRepository.markAllAsRead(recipient_id);
  }
}

export default NotificationsService;
