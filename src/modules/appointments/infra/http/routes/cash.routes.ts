import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import ensurePermission from '@shared/infra/http/middlewares/ensurePermission';
import CashController from '../controllers/CashController';

const cashRouter = Router();
const cashController = new CashController();

const day = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .required();
const cents = Joi.number().integer().min(0).max(1000000);

// Caixa do dia: qualquer barbeiro (quem estiver no balcão)
cashRouter.use(ensureAuthenticated);
cashRouter.use(ensureRole('provider'));

cashRouter.get(
  '/',
  ensurePermission('cash', 'cash.close'),
  celebrate({ [Segments.QUERY]: { date: day } }),
  cashController.show,
);

cashRouter.post(
  '/close',
  ensurePermission('cash.close'),
  celebrate({
    [Segments.BODY]: {
      date: day,
      opening_cents: cents.required(),
      counted_cents: cents.required(),
      notes: Joi.string().max(300).allow('', null),
    },
  }),
  cashController.close,
);

// Fechar o dia: atendido (com a forma de pagamento) ou faltou, vários de uma vez
cashRouter.post(
  '/attendances',
  ensurePermission('cash'),
  celebrate({
    [Segments.BODY]: {
      items: Joi.array()
        .items(
          Joi.object({
            id: Joi.string().uuid().required(),
            attendance: Joi.string().valid('completed', 'no_show').required(),
            payment_method: Joi.string()
              .valid('pix', 'credit', 'debit', 'cash', 'membership')
              .allow(null),
            paid_cents: cents.allow(null),
          }),
        )
        .min(1)
        .max(100)
        .required(),
    },
  }),
  cashController.attendances,
);

// Desfazer um "atendido" ou "faltou" registrado errado
cashRouter.delete(
  '/attendances/:id',
  ensurePermission('cash'),
  celebrate({ [Segments.PARAMS]: { id: Joi.string().uuid().required() } }),
  cashController.undo,
);

// Completar ou corrigir a forma de pagamento de um atendimento
cashRouter.patch(
  '/payments/:id',
  ensurePermission('cash'),
  celebrate({
    [Segments.PARAMS]: { id: Joi.string().uuid().required() },
    [Segments.BODY]: {
      payment_method: Joi.string()
        .valid('pix', 'credit', 'debit', 'cash', 'membership')
        .allow(null)
        .required(),
      paid_cents: cents.allow(null),
    },
  }),
  cashController.payment,
);

export default cashRouter;
