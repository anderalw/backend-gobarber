import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureAdmin from '@shared/infra/http/middlewares/ensureAdmin';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import AgendaSettingsController from '../controllers/AgendaSettingsController';
import NoShowPolicyController from '../controllers/NoShowPolicyController';

const settingsRouter = Router();
const agendaSettingsController = new AgendaSettingsController();
const noShowPolicyController = new NoShowPolicyController();

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

// Faltas a partir das quais o cliente fica com alerta (e se ele ainda pode
// agendar pelo site)
settingsRouter.get(
  '/no-show',
  ensureRole('provider'),
  noShowPolicyController.show,
);

settingsRouter.put(
  '/no-show',
  ensureRole('provider'),
  ensureAdmin,
  celebrate({
    [Segments.BODY]: {
      alert_threshold: Joi.number().integer().min(0).max(10).required(),
      block_online: Joi.boolean().required(),
    },
  }),
  noShowPolicyController.update,
);

export default settingsRouter;
