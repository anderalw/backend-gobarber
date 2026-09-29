import FakeNotificationsRepository from '../repositories/fakes/FakeNotificationsRepository';
import NotificationsService, {
  NOTIFICATIONS_LIMIT,
  dateFromContent,
} from './NotificationsService';

let fakeNotificationsRepository: FakeNotificationsRepository;
let notificationsService: NotificationsService;

const notify = (recipient_id: string, content: string, date?: Date) =>
  fakeNotificationsRepository.create({ recipient_id, content, date });

describe('Notifications', () => {
  beforeEach(() => {
    fakeNotificationsRepository = new FakeNotificationsRepository();
    notificationsService = new NotificationsService(
      fakeNotificationsRepository,
    );
  });

  it('should list only the recipient notifications, newest first', async () => {
    await notify('joao', 'Primeira', new Date(2026, 9, 1, 12));
    await notify('carlos', 'De outro barbeiro');
    await notify('joao', 'Segunda');

    const { notifications, unread } = await notificationsService.list('joao');

    expect(notifications.map(item => item.content)).toEqual([
      'Segunda',
      'Primeira',
    ]);
    expect(notifications[1]).toMatchObject({
      read: false,
      date: new Date(2026, 9, 1, 12),
    });
    expect(notifications[0].date).toBeNull();
    expect(unread).toBe(2);
  });

  it('should list at most the limit', async () => {
    await Promise.all(
      Array.from({ length: NOTIFICATIONS_LIMIT + 5 }, (_, index) =>
        notify('joao', `Notificação ${index}`),
      ),
    );

    const { notifications, unread } = await notificationsService.list('joao');

    expect(notifications).toHaveLength(NOTIFICATIONS_LIMIT);
    expect(unread).toBe(NOTIFICATIONS_LIMIT + 5);
  });

  it('should mark one notification as read', async () => {
    const first = await notify('joao', 'Primeira');
    await notify('joao', 'Segunda');

    await notificationsService.markAsRead(first.id.toHexString(), 'joao');

    expect(await notificationsService.unreadCount('joao')).toBe(1);

    const { notifications } = await notificationsService.list('joao', true);

    expect(notifications.map(item => item.content)).toEqual(['Segunda']);
  });

  it("should not mark someone else's notification", async () => {
    const other = await notify('carlos', 'De outro barbeiro');

    await expect(
      notificationsService.markAsRead(other.id.toHexString(), 'joao'),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await notificationsService.unreadCount('carlos')).toBe(1);
  });

  it('should mark all as read', async () => {
    await notify('joao', 'Primeira');
    await notify('joao', 'Segunda');
    await notify('carlos', 'De outro barbeiro');

    await notificationsService.markAllAsRead('joao');

    expect(await notificationsService.unreadCount('joao')).toBe(0);
    expect(await notificationsService.unreadCount('carlos')).toBe(1);
  });

  it('should read the appointment date from old notification texts', () => {
    expect(
      dateFromContent(
        'Novo agendamento de Cabelo para dia 29/09/2026 às 12:30h',
      ),
    ).toEqual(new Date(2026, 8, 29, 12, 30));
    expect(
      dateFromContent(
        'Agendamento de Cabelo remarcado de 29/09/2026 às 12:30 para 01/10/2026 às 09:00',
      ),
    ).toEqual(new Date(2026, 9, 1, 9, 0));
    expect(dateFromContent('Sem data')).toBeNull();
  });
});
