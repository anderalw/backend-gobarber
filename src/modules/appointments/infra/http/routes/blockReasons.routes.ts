import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensurePermission from '@shared/infra/http/middlewares/ensurePermission';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import BlockReasonsController from '../controllers/BlockReasonsController';

const blockReasonsRouter = Router();
const blockReasonsController = new BlockReasonsController();

// Todos os barbeiros escolhem o motivo ao bloquear; só administradores
// cadastram, editam e excluem
blockReasonsRouter.use(ensureAuthenticated);
blockReasonsRouter.use(ensureRole('provider'));

const reasonId = { [Segments.PARAMS]: { id: Joi.string().uuid().required() } };
const reasonBody = { [Segments.BODY]: { name: Joi.string().required() } };

blockReasonsRouter.get('/', blockReasonsController.index);
blockReasonsRouter.post(
  '/',
  ensurePermission('catalog'),
  celebrate(reasonBody),
  blockReasonsController.create,
);
blockReasonsRouter.put(
  '/:id',
  ensurePermission('catalog'),
  celebrate({ ...reasonId, ...reasonBody }),
  blockReasonsController.update,
);
blockReasonsRouter.delete(
  '/:id',
  ensurePermission('catalog'),
  celebrate(reasonId),
  blockReasonsController.delete,
);

export default blockReasonsRouter;
