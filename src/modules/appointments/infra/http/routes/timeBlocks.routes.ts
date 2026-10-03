import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import TimeBlocksController from '../controllers/TimeBlocksController';
import { forBodyProviders, forTimeBlock } from '../middlewares/agendaAccess';

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
      provider_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
      start_date: Joi.date().iso().required(),
      end_date: Joi.date().iso().required(),
      reason_id: Joi.string().uuid().required(),
    },
  }),
  forBodyProviders,
  timeBlocksController.create,
);
// Repete nos dias da semana escolhidos, com ou sem data de fim
const time = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);
const day = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

timeBlocksRouter.post(
  '/recurring',
  celebrate({
    [Segments.BODY]: {
      provider_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
      days_of_week: Joi.array()
        .items(Joi.number().integer().min(0).max(6))
        .min(1)
        .required(),
      start_time: time.required(),
      end_time: time.required(),
      starts_on: day.required(),
      ends_on: day.allow(null),
      reason_id: Joi.string().uuid().required(),
    },
  }),
  forBodyProviders,
  timeBlocksController.createRecurring,
);
// Remove um bloqueio avulso ou uma repetição inteira
timeBlocksRouter.delete(
  '/:id',
  celebrate({
    [Segments.PARAMS]: { id: Joi.string().uuid().required() },
  }),
  forTimeBlock,
  timeBlocksController.delete,
);

export default timeBlocksRouter;
