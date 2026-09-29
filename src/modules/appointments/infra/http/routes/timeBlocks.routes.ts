import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import TimeBlocksController from '../controllers/TimeBlocksController';

const timeBlocksRouter = Router();
const timeBlocksController = new TimeBlocksController();

// Como na agenda compartilhada, qualquer barbeiro bloqueia horários de
// qualquer barbeiro. Os bloqueios aparecem na agenda do dia e da semana
timeBlocksRouter.use(ensureAuthenticated);
timeBlocksRouter.use(ensureRole('provider'));

timeBlocksRouter.post(
  '/',
  celebrate({
    [Segments.BODY]: {
      provider_id: Joi.string().uuid().required(),
      start_date: Joi.date().iso().required(),
      end_date: Joi.date().iso().required(),
      reason: Joi.string().trim().max(60).allow('', null),
    },
  }),
  timeBlocksController.create,
);
timeBlocksRouter.delete(
  '/:id',
  celebrate({
    [Segments.PARAMS]: { id: Joi.string().uuid().required() },
  }),
  timeBlocksController.delete,
);

export default timeBlocksRouter;
