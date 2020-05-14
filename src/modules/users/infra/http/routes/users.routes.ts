import { Router } from 'express';
import multer from 'multer';
import uploadConfig from '@config/upload';
import UserAvatarController from '../controller/UserAvatarController';

import UsersController from '../controller/UsersController';

import ensureAuthencicated from '../middlewares/ensureAuthenticated';

const usersRouter = Router();
const upload = multer(uploadConfig);
const userAvatarController = new UserAvatarController();
const usersController = new UsersController();

usersRouter.post('/', usersController.create);

usersRouter.patch(
  '/avatar',
  ensureAuthencicated,
  upload.single('avatar'),
  userAvatarController.update,
);

export default usersRouter;
