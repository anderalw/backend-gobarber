import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import ensurePermission from '@shared/infra/http/middlewares/ensurePermission';
import ReportsController from '../controllers/ReportsController';

const reportsRouter = Router();
const reportsController = new ReportsController();

const day = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

// Faturamento: só administradores
reportsRouter.use(ensureAuthenticated);
reportsRouter.use(ensureRole('provider'));
reportsRouter.use(ensurePermission('reports'));

reportsRouter.get(
  '/revenue',
  celebrate({
    [Segments.QUERY]: { start: day.required(), end: day.required() },
  }),
  reportsController.revenue,
);

// Indicadores: ocupação, faltas, serviços, horários e clientes
reportsRouter.get(
  '/insights',
  celebrate({
    [Segments.QUERY]: { start: day.required(), end: day.required() },
  }),
  reportsController.insights,
);

// Clientes que não voltam há alguns dias
reportsRouter.get(
  '/lost-clients',
  celebrate({
    [Segments.QUERY]: {
      days: Joi.number().integer().min(7).max(365).required(),
    },
  }),
  reportsController.lostClients,
);

export default reportsRouter;
