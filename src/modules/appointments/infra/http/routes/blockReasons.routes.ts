import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureAdmin from '@shared/infra/http/middlewares/ensureAdmin';
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
  ensureAdmin,
  celebrate(reasonBody),
  blockReasonsController.create,
);
blockReasonsRouter.put(
  '/:id',
  ensureAdmin,
  celebrate({ ...reasonId, ...reasonBody }),
  blockReasonsController.update,
);
blockReasonsRouter.delete(
  '/:id',
  ensureAdmin,
  celebrate(reasonId),
  blockReasonsController.delete,
);

export default blockReasonsRouter;
