import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureAdmin from '@shared/infra/http/middlewares/ensureAdmin';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import CardChargesController from '../controllers/CardChargesController';
import TerminalSimulatorController from '../controllers/TerminalSimulatorController';

const cardChargesRouter = Router();
const controller = new CardChargesController();
const simulatorController = new TerminalSimulatorController();

cardChargesRouter.use(ensureAuthenticated);
cardChargesRouter.use(ensureRole('provider'));

// Operadora em uso e as maquininhas ativas (para cobrar)
cardChargesRouter.get('/settings', controller.settings);

// Configuração (admin): conta da operadora e cadastro das maquininhas
cardChargesRouter.get('/settings/admin', ensureAdmin, controller.adminSettings);
cardChargesRouter.put(
  '/settings',
  ensureAdmin,
  celebrate({
    [Segments.BODY]: {
      provider: Joi.string().max(40).allow('', null),
      credentials: Joi.object()
        .pattern(Joi.string().max(40), Joi.string().max(500).allow(''))
        .max(10),
    },
  }),
  controller.updateSettings,
);
cardChargesRouter.post(
  '/settings/test',
  ensureAdmin,
  controller.testConnection,
);

const deviceId = {
  [Segments.PARAMS]: { id: Joi.string().uuid().required() },
};

cardChargesRouter.get(
  '/devices/discover',
  ensureAdmin,
  controller.discoverDevices,
);
cardChargesRouter.post(
  '/devices',
  ensureAdmin,
  celebrate({
    [Segments.BODY]: {
      external_id: Joi.string().trim().max(100).required(),
      name: Joi.string().trim().max(60).required(),
    },
  }),
  controller.createDevice,
);
cardChargesRouter.put(
  '/devices/:id',
  ensureAdmin,
  celebrate({
    ...deviceId,
    [Segments.BODY]: {
      name: Joi.string().trim().max(60),
      active: Joi.boolean(),
    },
  }),
  controller.updateDevice,
);
cardChargesRouter.delete(
  '/devices/:id',
  ensureAdmin,
  celebrate(deviceId),
  controller.deleteDevice,
);

// Maquininha simulada (testes sem operadora)
cardChargesRouter.get('/simulator', simulatorController.show);
cardChargesRouter.post(
  '/simulator/:external_id',
  celebrate({
    [Segments.PARAMS]: { external_id: Joi.string().max(100).required() },
    [Segments.BODY]: {
      result: Joi.string()
        .valid('credit', 'debit', 'pix', 'rejected')
        .required(),
    },
  }),
  simulatorController.resolve,
);

// Cobrar um atendimento na maquininha
cardChargesRouter.post(
  '/',
  celebrate({
    [Segments.BODY]: {
      appointment_id: Joi.string().uuid().required(),
      device_id: Joi.string().uuid().required(),
      amount_cents: Joi.number().integer().min(100).max(1000000).allow(null),
    },
  }),
  controller.create,
);

const chargeId = {
  [Segments.PARAMS]: { id: Joi.string().uuid().required() },
};

cardChargesRouter.get('/:id', celebrate(chargeId), controller.show);
cardChargesRouter.post('/:id/cancel', celebrate(chargeId), controller.cancel);

export default cardChargesRouter;
