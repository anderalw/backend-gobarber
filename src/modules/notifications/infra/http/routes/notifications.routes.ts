import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import NotificationsController from '../controllers/NotificationsController';

const notificationsRouter = Router();
const notificationsController = new NotificationsController();

// Só barbeiros recebem notificações; cada um vê as próprias
notificationsRouter.use(ensureAuthenticated);
notificationsRouter.use(ensureRole('provider'));

notificationsRouter.get(
  '/',
  celebrate({
    [Segments.QUERY]: { unread: Joi.boolean() },
  }),
  notificationsController.index,
);
// Para o contador do menu, consultado de tempos em tempos
notificationsRouter.get('/unread-count', notificationsController.unreadCount);
notificationsRouter.patch('/read-all', notificationsController.readAll);
notificationsRouter.patch(
  '/:id/read',
  celebrate({
    [Segments.PARAMS]: { id: Joi.string().hex().length(24).required() },
  }),
  notificationsController.read,
);

export default notificationsRouter;
