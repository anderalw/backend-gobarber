import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import ClientsController from '../controllers/ClientsController';

const clientsRouter = Router();
const clientsController = new ClientsController();

// Cadastro feito pelo próprio cliente no site
clientsRouter.post(
  '/',
  celebrate({
    [Segments.BODY]: {
      name: Joi.string().trim().max(100).required(),
      email: Joi.string().trim().email().max(100).required(),
      password: Joi.string().min(6).max(100).required(),
      phone: Joi.string().trim().max(30).required(),
    },
  }),
  clientsController.create,
);

// Cadastro rápido pelo barbeiro ao marcar pela agenda (sem senha)
clientsRouter.post(
  '/by-provider',
  ensureAuthenticated,
  ensureRole('provider'),
  celebrate({
    [Segments.BODY]: {
      name: Joi.string().trim().max(100).required(),
      phone: Joi.string().trim().max(30).required(),
      email: Joi.string().trim().email().max(100).allow('', null),
    },
  }),
  clientsController.createByProvider,
);

// Só barbeiros veem a lista de clientes
clientsRouter.get(
  '/',
  ensureAuthenticated,
  ensureRole('provider'),
  celebrate({
    [Segments.QUERY]: { search: Joi.string().max(100).required() },
  }),
  clientsController.index,
);

export default clientsRouter;
