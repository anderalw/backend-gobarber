import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import ProfileController from '../controllers/ProfileController';

import ensureAuthencicated from '../middlewares/ensureAuthenticated';

const profileRouter = Router();
const profileController = new ProfileController();

profileRouter.use(ensureAuthencicated);
profileRouter.use(ensureRole('provider'));

profileRouter.get('/', profileController.show);
profileRouter.put(
  '/',
  celebrate({
    [Segments.BODY]: {
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      old_password: Joi.string(),
      password: Joi.string(),
      password_confirmation: Joi.string().valid(Joi.ref('password')),
    },
  }),
  profileController.update,
);

// Senha provisória: o único caminho liberado além de ver o perfil
profileRouter.put(
  '/password',
  celebrate({
    [Segments.BODY]: {
      password: Joi.string().min(6).max(100).required(),
      password_confirmation: Joi.string().valid(Joi.ref('password')).required(),
    },
  }),
  profileController.changePassword,
);

export default profileRouter;
