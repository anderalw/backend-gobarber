import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensurePermission from '@shared/infra/http/middlewares/ensurePermission';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import RolesController from '../controllers/RolesController';

// Perfis de acesso da equipe
const rolesRouter = Router();
const rolesController = new RolesController();

rolesRouter.use(ensureAuthenticated, ensureRole('provider'));
rolesRouter.use(ensurePermission('team'));

const body = {
  [Segments.BODY]: {
    name: Joi.string().trim().max(60).required(),
    permissions: Joi.array().items(Joi.string().max(40)).required(),
  },
};
const roleId = { [Segments.PARAMS]: { id: Joi.string().uuid().required() } };

rolesRouter.get('/', rolesController.index);
rolesRouter.get('/permissions', rolesController.permissions);
rolesRouter.post('/', celebrate(body), rolesController.create);
rolesRouter.put(
  '/:id',
  celebrate({ ...roleId, ...body }),
  rolesController.update,
);
rolesRouter.delete('/:id', celebrate(roleId), rolesController.delete);

export default rolesRouter;
