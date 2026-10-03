import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import ensurePermission from '@shared/infra/http/middlewares/ensurePermission';
import profileExtras from '@shared/infra/http/profileExtrasSchema';
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
      ...profileExtras,
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
      ...profileExtras,
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
  ensurePermission('clients'),
  celebrate({
    [Segments.QUERY]: { search: Joi.string().max(100).required() },
  }),
  clientsController.index,
);

// O próprio cliente: nome e telefone
clientsRouter.put(
  '/me',
  ensureAuthenticated,
  ensureRole('client'),
  celebrate({
    [Segments.BODY]: {
      name: Joi.string().trim().max(100).required(),
      phone: Joi.string().trim().max(30).required(),
      ...profileExtras,
    },
  }),
  clientsController.updateMe,
);

// Ficha e lista de clientes (barbearia)
clientsRouter.get(
  '/directory',
  ensureAuthenticated,
  ensureRole('provider'),
  celebrate({
    [Segments.QUERY]: {
      search: Joi.string().trim().max(100).allow(''),
      page: Joi.number().integer().min(1).max(10000),
    },
  }),
  clientsController.directory,
);

const clientId = {
  [Segments.PARAMS]: { id: Joi.string().uuid().required() },
};

clientsRouter.get(
  '/:id',
  ensureAuthenticated,
  ensureRole('provider'),
  ensurePermission('clients'),
  celebrate(clientId),
  clientsController.show,
);

clientsRouter.put(
  '/:id',
  ensureAuthenticated,
  ensureRole('provider'),
  ensurePermission('clients'),
  celebrate({
    ...clientId,
    [Segments.BODY]: {
      name: Joi.string().trim().max(100).required(),
      phone: Joi.string().trim().max(30).required(),
      ...profileExtras,
      email: Joi.string().trim().email().max(100).allow('', null),
      notes: Joi.string().max(2000).allow('', null),
    },
  }),
  clientsController.update,
);

export default clientsRouter;
