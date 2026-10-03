import { Router } from 'express';
import multer from 'multer';
import uploadConfig from '@config/upload';
import { keepTenant } from '@shared/tenancy/TenantContext';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureAdmin from '@shared/infra/http/middlewares/ensureAdmin';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import UsersController from '../controllers/UsersController';
import UserAvatarController from '../controllers/UserAvatarController';
import TeamController from '../controllers/TeamController';

const usersRouter = Router();
const usersController = new UsersController();
const userAvatarController = new UserAvatarController();
const teamController = new TeamController();
const upload = multer(uploadConfig.multer);

usersRouter.post(
  '/',
  ensureAuthenticated,
  ensureRole('provider'),
  ensureAdmin,
  celebrate({
    [Segments.BODY]: {
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    },
  }),
  usersController.create,
);

usersRouter.patch(
  '/avatar',
  ensureAuthenticated,
  ensureRole('provider'),
  keepTenant(upload.single('avatar')),
  userAvatarController.update,
);

// Administração da equipe: lista com horários, edição e ativar/desativar
const onlyAdmin = [ensureAuthenticated, ensureRole('provider'), ensureAdmin];
const providerIdParam = {
  [Segments.PARAMS]: { provider_id: Joi.string().uuid().required() },
};

usersRouter.get('/', ...onlyAdmin, teamController.index);

usersRouter.put(
  '/:provider_id',
  ...onlyAdmin,
  celebrate({
    ...providerIdParam,
    [Segments.BODY]: {
      name: Joi.string().trim().required(),
      email: Joi.string().trim().email().required(),
    },
  }),
  teamController.update,
);

usersRouter.patch(
  '/:provider_id/active',
  ...onlyAdmin,
  celebrate({
    ...providerIdParam,
    [Segments.BODY]: { active: Joi.boolean().required() },
  }),
  teamController.setActive,
);

export default usersRouter;
