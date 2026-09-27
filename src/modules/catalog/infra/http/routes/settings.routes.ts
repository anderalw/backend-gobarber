import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureAdmin from '@shared/infra/http/middlewares/ensureAdmin';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import AgendaSettingsController from '../controllers/AgendaSettingsController';

const settingsRouter = Router();
const agendaSettingsController = new AgendaSettingsController();

settingsRouter.use(ensureAuthenticated);

settingsRouter.get('/agenda', agendaSettingsController.show);

settingsRouter.put(
  '/agenda',
  ensureRole('provider'),
  ensureAdmin,
  celebrate({
    [Segments.BODY]: { buffer_minutes: Joi.number().integer().required() },
  }),
  agendaSettingsController.update,
);

export default settingsRouter;
