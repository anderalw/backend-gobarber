import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import WaitlistController from '../controllers/WaitlistController';

const waitlistRouter = Router();
const waitlistController = new WaitlistController();

const day = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .required();
const period = Joi.string().valid('any', 'morning', 'afternoon', 'evening');

waitlistRouter.use(ensureAuthenticated);

// Cliente: os próprios pedidos e entrar na lista de um dia lotado
waitlistRouter.get('/me', ensureRole('client'), waitlistController.mine);
waitlistRouter.post(
  '/me',
  ensureRole('client'),
  celebrate({
    [Segments.BODY]: {
      date: day,
      provider_id: Joi.string().uuid().allow(null),
      service_id: Joi.string().uuid().allow(null),
      period,
    },
  }),
  waitlistController.join,
);

// Barbearia: a lista do dia e colocar um cliente nela
waitlistRouter.get(
  '/',
  ensureRole('provider'),
  celebrate({ [Segments.QUERY]: { date: day } }),
  waitlistController.index,
);
waitlistRouter.post(
  '/',
  ensureRole('provider'),
  celebrate({
    [Segments.BODY]: {
      client_id: Joi.string().uuid().required(),
      date: day,
      provider_id: Joi.string().uuid().allow(null),
      service_id: Joi.string().uuid().allow(null),
      period,
      notes: Joi.string().max(200).allow('', null),
    },
  }),
  waitlistController.create,
);

// Tirar da lista (o cliente só os próprios pedidos)
waitlistRouter.delete(
  '/:id',
  celebrate({ [Segments.PARAMS]: { id: Joi.string().uuid().required() } }),
  waitlistController.delete,
);

export default waitlistRouter;
