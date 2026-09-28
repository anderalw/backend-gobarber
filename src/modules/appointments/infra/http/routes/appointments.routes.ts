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

export default appointmentsRouter;
