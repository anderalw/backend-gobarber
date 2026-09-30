import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import AppointmentsController from '../controllers/AppointmentsController';
import ProviderAppointmentsController from '../controllers/ProviderAppointmentsController';

const appointmentsRouter = Router();
const appointmentsController = new AppointmentsController();
const providerAppointmentsController = new ProviderAppointmentsController();

const appointmentId = {
  [Segments.PARAMS]: { id: Joi.string().uuid().required() },
};

appointmentsRouter.use(ensureAuthenticated);

appointmentsRouter.post(
  '/',
  ensureRole('client'),
  celebrate({
    [Segments.BODY]: {
      provider_id: Joi.string().uuid().required(),
      service_id: Joi.string().uuid().required(),
      date: Joi.date().required(),
    },
  }),
  appointmentsController.create,
);
// Cliente sem preferência de barbeiro: o sistema escolhe quem está livre
appointmentsRouter.post(
  '/any',
  ensureRole('client'),
  celebrate({
    [Segments.BODY]: {
      service_id: Joi.string().uuid().required(),
      date: Joi.date().required(),
    },
  }),
  appointmentsController.createWithAnyProvider,
);
// Barbeiro marcando pela agenda para um cliente (cadastrado antes, se
// preciso, por POST /clients/by-provider)
appointmentsRouter.post(
  '/by-provider',
  ensureRole('provider'),
  celebrate({
    [Segments.BODY]: {
      provider_id: Joi.string().uuid().required(),
      service_id: Joi.string().uuid().required(),
      date: Joi.date().required(),
      client_id: Joi.string().uuid().required(),
    },
  }),
  appointmentsController.createByProvider,
);
// Cliente fixo: o mesmo horário a cada N semanas
appointmentsRouter.post(
  '/series',
  ensureRole('provider'),
  celebrate({
    [Segments.BODY]: {
      provider_id: Joi.string().uuid().required(),
      service_id: Joi.string().uuid().required(),
      client_id: Joi.string().uuid().required(),
      date: Joi.date().required(),
      interval_weeks: Joi.number().integer().min(1).max(8).required(),
      count: Joi.number().integer().min(2).max(26).required(),
      dry_run: Joi.boolean(),
    },
  }),
  appointmentsController.createSeries,
);
appointmentsRouter.get(
  '/me',
  ensureRole('provider'),
  providerAppointmentsController.index,
);
appointmentsRouter.get(
  '/mine',
  ensureRole('client'),
  appointmentsController.mine,
);

// Barbeiros alteram qualquer agendamento; clientes só os próprios, com
// antecedência (regras em ensureCanChangeAppointment)
appointmentsRouter.patch(
  '/:id/cancel',
  celebrate(appointmentId),
  appointmentsController.cancel,
);
appointmentsRouter.patch(
  '/:id/cancel-series',
  ensureRole('provider'),
  celebrate(appointmentId),
  appointmentsController.cancelSeries,
);
appointmentsRouter.patch(
  '/:id/reschedule',
  celebrate({
    ...appointmentId,
    [Segments.BODY]: {
      provider_id: Joi.string().uuid().required(),
      date: Joi.date().required(),
    },
  }),
  appointmentsController.reschedule,
);

// Antes do horário: a barbearia registra que o cliente confirmou (por
// telefone, por exemplo), ou desfaz esse registro
appointmentsRouter.patch(
  '/:id/confirmation',
  ensureRole('provider'),
  celebrate({
    ...appointmentId,
    [Segments.BODY]: { confirmed: Joi.boolean().required() },
  }),
  appointmentsController.confirmation,
);

// Depois do horário: o barbeiro registra se o cliente foi atendido ou faltou
appointmentsRouter.patch(
  '/:id/attendance',
  ensureRole('provider'),
  celebrate({
    ...appointmentId,
    [Segments.BODY]: {
      attendance: Joi.string()
        .valid('completed', 'no_show')
        .allow(null)
        .required(),
      payment_method: Joi.string()
        .valid('pix', 'credit', 'debit', 'cash', 'membership')
        .allow(null),
      paid_cents: Joi.number().integer().min(0).max(1000000).allow(null),
    },
  }),
  appointmentsController.attendance,
);

export default appointmentsRouter;
