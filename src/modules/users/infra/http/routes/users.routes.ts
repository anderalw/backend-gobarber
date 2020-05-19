import { Router } from 'express';
import multer from 'multer';
import uploadConfig from '@config/upload';
import UserAvatarController from '../controller/UserAvatarController';

import UsersController from '../controller/UsersController';

import ensureAuthencicated from '../middlewares/ensureAuthenticated';

const usersRouter = Router();
const usersController = new UsersController();
const userAvatarController = new UserAvatarController();
const upload = multer(uploadConfig);

usersRouter.post('/', usersController.create);

usersRouter.patch(
  '/avatar',
  ensureAuthencicated,
  upload.single('avatar'),
  userAvatarController.update,
);

export default usersRouter;
