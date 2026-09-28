import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import AgendaController from '../controllers/AgendaController';

const agendaRouter = Router();
const agendaController = new AgendaController();

// Agenda compartilhada: qualquer barbeiro vê os agendamentos de todos
agendaRouter.use(ensureAuthenticated);
agendaRouter.use(ensureRole('provider'));

const dateQuery = celebrate({
  [Segments.QUERY]: {
    day: Joi.number().integer().min(1).max(31).required(),
    month: Joi.number().integer().min(1).max(12).required(),
    year: Joi.number().integer().min(2000).max(2100).required(),
  },
});

agendaRouter.get('/day', dateQuery, agendaController.index);
// Visão semanal: sete dias a partir da data (o domingo da semana)
agendaRouter.get('/week', dateQuery, agendaController.week);

export default agendaRouter;
