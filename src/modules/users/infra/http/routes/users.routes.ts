import { Router } from 'express';
import multer from 'multer';
import uploadConfig from '@config/upload';
import { celebrate, Segments, Joi } from 'celebrate';

import UserAvatarController from '../controllers/UserAvatarController';

import UsersController from '../controllers/UsersController';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';

import ensureAuthencicated from '../middlewares/ensureAuthenticated';
import ensureAdmin from '@shared/infra/http/middlewares/ensureAdmin';

const usersRouter = Router();
const usersController = new UsersController();
const userAvatarController = new UserAvatarController();
const upload = multer(uploadConfig.multer);

usersRouter.post(
  '/',
  ensureAuthenticated,
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
  ensureAuthencicated,
  upload.single('avatar'),
  userAvatarController.update,
);

export default usersRouter;
