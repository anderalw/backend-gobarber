import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensurePermission from '@shared/infra/http/middlewares/ensurePermission';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import BarbersController from '../controllers/BarbersController';

// Quem atende: escolhido entre os usuários da equipe
const barbersRouter = Router();
const barbersController = new BarbersController();

barbersRouter.use(ensureAuthenticated, ensureRole('provider'));
barbersRouter.use(ensurePermission('team'));

barbersRouter.get('/', barbersController.index);
barbersRouter.post(
  '/',
  celebrate({ [Segments.BODY]: { user_id: Joi.string().uuid().required() } }),
  barbersController.create,
);
barbersRouter.delete(
  '/:id',
  celebrate({ [Segments.PARAMS]: { id: Joi.string().uuid().required() } }),
  barbersController.delete,
);

export default barbersRouter;
