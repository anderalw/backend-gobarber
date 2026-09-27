import { Router } from 'express';
import SessionsController from '../controllers/SessionsController';

const clientsSessionsRouter = Router();
const sessionsController = new SessionsController();

clientsSessionsRouter.post('/', sessionsController.create);

export default clientsSessionsRouter;