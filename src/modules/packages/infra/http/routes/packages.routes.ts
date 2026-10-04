import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensurePermission from '@shared/infra/http/middlewares/ensurePermission';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import PackagesController from '../controllers/PackagesController';

const packagesRouter = Router();
const controller = new PackagesController();

packagesRouter.use(ensureAuthenticated);

// Cliente: os próprios pacotes e o saldo
packagesRouter.get('/me', ensureRole('client'), controller.mine);

packagesRouter.use(ensureRole('provider'), ensurePermission('clients'));

packagesRouter.get(
  '/',
  celebrate({
    [Segments.QUERY]: { client_id: Joi.string().uuid().required() },
  }),
  controller.index,
);
packagesRouter.post(
  '/',
  celebrate({
    [Segments.BODY]: {
      client_id: Joi.string().uuid().required(),
      service_id: Joi.string().uuid().required(),
      sessions: Joi.number().integer().min(1).max(100).required(),
      price_cents: Joi.number().integer().min(0).max(1000000).required(),
      payment_method: Joi.string()
        .valid('pix', 'credit', 'debit', 'cash')
        .required(),
    },
  }),
  controller.create,
);
packagesRouter.post(
  '/:id/cancel',
  celebrate({ [Segments.PARAMS]: { id: Joi.string().uuid().required() } }),
  controller.cancel,
);

export default packagesRouter;
