import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureAdmin from '@shared/infra/http/middlewares/ensureAdmin';
import ProviderSchedulesController from '../controllers/ProviderSchedulesController';

const providerSchedulesRouter = Router();
const providerSchedulesController = new ProviderSchedulesController();

// Todas as rotas deste ficheiro vão exigir autenticação e perfil de administrador
providerSchedulesRouter.use(ensureAuthenticated);
providerSchedulesRouter.use(ensureAdmin);

providerSchedulesRouter.post(
  '/:provider_id',
  celebrate({
    [Segments.PARAMS]: {
      provider_id: Joi.string().uuid().required(),
    },
    [Segments.BODY]: {
      schedules: Joi.array().items(
        Joi.object({
          day_of_week: Joi.number().min(0).max(6).required(),
          start_time: Joi.string().required(),
          end_time: Joi.string().required(),
        })
      ).required(),
    },
  }),
  providerSchedulesController.update,
);

export default providerSchedulesRouter;