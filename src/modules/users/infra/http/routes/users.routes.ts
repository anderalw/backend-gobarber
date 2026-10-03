import { Router } from 'express';
import multer from 'multer';
import uploadConfig from '@config/upload';
import { keepTenant } from '@shared/tenancy/TenantContext';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensurePermission from '@shared/infra/http/middlewares/ensurePermission';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import profileExtras from '@shared/infra/http/profileExtrasSchema';
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

// Usuários da equipe: quem entra no sistema e o que pode fazer (perfil
// opcional + permissões próprias). A senha provisória é o próprio e-mail
usersRouter.use(ensurePermission('team'));

const userId = { [Segments.PARAMS]: { id: Joi.string().uuid().required() } };

usersRouter.get('/', staffUsersController.index);
usersRouter.get('/:id', celebrate(userId), staffUsersController.show);

usersRouter.post(
  '/',
  celebrate({
    [Segments.BODY]: {
      name: Joi.string().trim().max(100).required(),
      email: Joi.string().trim().email().required(),
      role_id: Joi.string().uuid().allow(null),
      permissions: Joi.array().items(Joi.string().max(40)),
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
      role_id: Joi.string().uuid().allow(null).required(),
      permissions: Joi.array().items(Joi.string().max(40)).required(),
      phone: Joi.string().trim().max(30).allow('', null),
      ...profileExtras,
    },
  }),
  staffUsersController.update,
);

// Senha provisória de novo (o e-mail), com troca no próximo acesso
usersRouter.post(
  '/:id/reset-password',
  celebrate(userId),
  staffUsersController.resetPassword,
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
