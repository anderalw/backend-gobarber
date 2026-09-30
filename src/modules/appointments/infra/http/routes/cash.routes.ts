import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
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
  celebrate({ [Segments.QUERY]: { date: day } }),
  cashController.show,
);

cashRouter.post(
  '/close',
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

// Completar ou corrigir a forma de pagamento de um atendimento
cashRouter.patch(
  '/payments/:id',
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
