import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureAdmin from '@shared/infra/http/middlewares/ensureAdmin';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import ReportsController from '../controllers/ReportsController';

const reportsRouter = Router();
const reportsController = new ReportsController();

const day = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

// Faturamento: só administradores
reportsRouter.use(ensureAuthenticated);
reportsRouter.use(ensureRole('provider'));
reportsRouter.use(ensureAdmin);

reportsRouter.get(
  '/revenue',
  celebrate({
    [Segments.QUERY]: { start: day.required(), end: day.required() },
  }),
  reportsController.revenue,
);

export default reportsRouter;
