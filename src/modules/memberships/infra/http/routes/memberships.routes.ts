import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensurePermission from '@shared/infra/http/middlewares/ensurePermission';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import MembershipsController from '../controllers/MembershipsController';

const membershipsRouter = Router();
const controller = new MembershipsController();

const id = { [Segments.PARAMS]: { id: Joi.string().uuid().required() } };
const cents = Joi.number().integer().min(0).max(1000000);
const payment = {
  payment_method: Joi.string()
    .valid('pix', 'credit', 'debit', 'cash')
    .required(),
  amount_cents: cents.allow(null),
};
const plan = {
  name: Joi.string().trim().max(60).required(),
  description: Joi.string().trim().max(300).allow('', null),
  price_cents: cents.min(100).required(),
  items: Joi.array()
    .items({
      service_id: Joi.string().uuid().required(),
      quantity: Joi.number().integer().min(1).max(31).allow(null).required(),
    })
    .min(1)
    .max(30)
    .required(),
  min_interval_days: Joi.number().integer().min(1).max(60).allow(null),
  weekdays: Joi.array()
    .items(Joi.number().integer().min(0).max(6))
    .max(7)
    .allow(null),
  discount_percent: Joi.number().integer().min(0).max(100).required(),
  active: Joi.boolean().required(),
};
const benefitQuery = {
  service_id: Joi.string().uuid().required(),
  date: Joi.date().required(),
};

// Site: planos à venda (sem login)
membershipsRouter.get('/plans/public', controller.publicPlans);

membershipsRouter.use(ensureAuthenticated);

// Cliente: a própria assinatura, pedir um plano e ver o benefício
membershipsRouter.get('/me', ensureRole('client'), controller.mine);
membershipsRouter.post(
  '/me',
  ensureRole('client'),
  celebrate({
    [Segments.BODY]: { plan_id: Joi.string().uuid().required() },
  }),
  controller.request,
);
membershipsRouter.post(
  '/me/withdraw',
  ensureRole('client'),
  controller.withdraw,
);
membershipsRouter.get(
  '/me/benefit',
  ensureRole('client'),
  celebrate({ [Segments.QUERY]: benefitQuery }),
  controller.myBenefit,
);

// Barbearia
membershipsRouter.use(ensureRole('provider'));

const club = ensurePermission('club');

membershipsRouter.get('/', club, controller.overview);
membershipsRouter.get(
  '/plans',
  ensurePermission('club', 'catalog'),
  controller.plans,
);
membershipsRouter.post(
  '/plans',
  ensurePermission('catalog'),
  celebrate({ [Segments.BODY]: plan }),
  controller.createPlan,
);
membershipsRouter.put(
  '/plans/:id',
  ensurePermission('catalog'),
  celebrate({ ...id, [Segments.BODY]: plan }),
  controller.updatePlan,
);
membershipsRouter.get(
  '/benefit',
  celebrate({
    [Segments.QUERY]: {
      ...benefitQuery,
      client_id: Joi.string().uuid().required(),
    },
  }),
  controller.benefit,
);
membershipsRouter.get(
  '/client/:client_id',
  club,
  celebrate({
    [Segments.PARAMS]: { client_id: Joi.string().uuid().required() },
  }),
  controller.forClient,
);
membershipsRouter.post(
  '/',
  club,
  celebrate({
    [Segments.BODY]: {
      client_id: Joi.string().uuid().required(),
      plan_id: Joi.string().uuid().required(),
      ...payment,
    },
  }),
  controller.subscribe,
);
membershipsRouter.post(
  '/:id/confirm',
  club,
  celebrate({ ...id, [Segments.BODY]: payment }),
  controller.confirm,
);
membershipsRouter.post(
  '/:id/payments',
  club,
  celebrate({ ...id, [Segments.BODY]: payment }),
  controller.pay,
);
membershipsRouter.post('/:id/cancel', club, celebrate(id), controller.cancel);

export default membershipsRouter;
