import { Router } from 'express';
import multer from 'multer';
import uploadConfig from '@config/upload';
import { keepTenant } from '@shared/tenancy/TenantContext';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensurePermission from '@shared/infra/http/middlewares/ensurePermission';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import UserAvatarController from '../controllers/UserAvatarController';
import StaffUsersController from '../controllers/StaffUsersController';

const usersRouter = Router();
const userAvatarController = new UserAvatarController();
const staffUsersController = new StaffUsersController();
const upload = multer(uploadConfig.multer);

usersRouter.use(ensureAuthenticated, ensureRole('provider'));

// A própria foto
usersRouter.patch(
  '/avatar',
  keepTenant(upload.single('avatar')),
  userAvatarController.update,
);

// Usuários da equipe: quem entra no sistema e com qual perfil
usersRouter.use(ensurePermission('team'));

const userId = { [Segments.PARAMS]: { id: Joi.string().uuid().required() } };

usersRouter.get('/', staffUsersController.index);

usersRouter.post(
  '/',
  celebrate({
    [Segments.BODY]: {
      name: Joi.string().trim().max(100).required(),
      email: Joi.string().trim().email().required(),
      password: Joi.string().min(6).max(100).required(),
      role_id: Joi.string().uuid().required(),
    },
  }),
  staffUsersController.create,
);

usersRouter.put(
  '/:id',
  celebrate({
    ...userId,
    [Segments.BODY]: {
      name: Joi.string().trim().max(100).required(),
      email: Joi.string().trim().email().required(),
      role_id: Joi.string().uuid().required(),
      password: Joi.string().min(6).max(100).allow(''),
    },
  }),
  staffUsersController.update,
);

usersRouter.patch(
  '/:id/active',
  celebrate({
    ...userId,
    [Segments.BODY]: { active: Joi.boolean().required() },
  }),
  staffUsersController.setActive,
);

export default usersRouter;
