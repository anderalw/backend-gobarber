import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';
import SessionsController from '../controllers/SessionsController';

const clientsSessionsRouter = Router();
const sessionsController = new SessionsController();

clientsSessionsRouter.post('/', sessionsController.create);

// Login com Google
clientsSessionsRouter.get('/google', sessionsController.googleConfig);
clientsSessionsRouter.post(
  '/google',
  celebrate({
    [Segments.BODY]: { credential: Joi.string().max(5000).required() },
  }),
  sessionsController.google,
);

export default clientsSessionsRouter;
