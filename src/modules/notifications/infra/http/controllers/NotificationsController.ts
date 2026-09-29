import { Request, Response } from 'express';
import { container } from 'tsyringe';

import NotificationsService from '@modules/notifications/services/NotificationsService';

export default class NotificationsController {
  public async index(request: Request, response: Response): Promise<Response> {
    const result = await container
      .resolve(NotificationsService)
      .list(request.user.id, request.query.unread === 'true');

    return response.json(result);
  }

  public async unreadCount(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const unread = await container
      .resolve(NotificationsService)
      .unreadCount(request.user.id);

    return response.json({ unread });
  }

  public async read(request: Request, response: Response): Promise<Response> {
    await container
      .resolve(NotificationsService)
      .markAsRead(request.params.id, request.user.id);

    return response.status(204).send();
  }

  public async readAll(
    request: Request,
    response: Response,
  ): Promise<Response> {
    await container
      .resolve(NotificationsService)
      .markAllAsRead(request.user.id);

    return response.status(204).send();
  }
}
