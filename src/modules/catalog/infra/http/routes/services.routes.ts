import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureAdmin from '@shared/infra/http/middlewares/ensureAdmin';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import ServicesController from '../controllers/ServicesController';

const servicesRouter = Router();
const servicesController = new ServicesController();

const onlyAdmin = [ensureRole('provider'), ensureAdmin];

const serviceBody = {
  name: Joi.string().required(),
  duration_minutes: Joi.number().integer().required(),
  price_cents: Joi.number().integer().required(),
};

servicesRouter.use(ensureAuthenticated);

servicesRouter.get('/', servicesController.index);
servicesRouter.get('/all', ...onlyAdmin, servicesController.all);

servicesRouter.post(
  '/',
  ...onlyAdmin,
  celebrate({ [Segments.BODY]: serviceBody }),
  servicesController.create,
);

servicesRouter.put(
  '/:id',
  ...onlyAdmin,
  celebrate({
    [Segments.PARAMS]: { id: Joi.string().uuid().required() },
    [Segments.BODY]: { ...serviceBody, active: Joi.boolean().required() },
  }),
  servicesController.update,
);

export default servicesRouter;
