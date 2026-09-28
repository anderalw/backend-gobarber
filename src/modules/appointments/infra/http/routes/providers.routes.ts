import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ProvidersController from '../controllers/ProvidersController';
import ProviderMonthAvailabilityController from '../controllers/ProviderMonthAvailabilityController';
import ProviderDayAvailabilityController from '../controllers/ProviderDayAvailabilityController';
import ProviderSlotController from '../controllers/ProviderSlotController';
import ProviderSuggestionsController from '../controllers/ProviderSuggestionsController';
import AnyProviderDayAvailabilityController from '../controllers/AnyProviderDayAvailabilityController';

const providersRouter = Router();
const providersController = new ProvidersController();
const providerMonthAvailabilityController =
  new ProviderMonthAvailabilityController();
const providerDayAvailabilityController =
  new ProviderDayAvailabilityController();
const providerSlotController = new ProviderSlotController();
const providerSuggestionsController = new ProviderSuggestionsController();
const anyProviderDayAvailabilityController =
  new AnyProviderDayAvailabilityController();

providersRouter.use(ensureAuthenticated);

providersRouter.get('/', providersController.index);
// "Qualquer barbeiro": horários em que pelo menos um barbeiro está livre
providersRouter.get(
  '/any/day-availability',
  celebrate({
    [Segments.QUERY]: {
      day: Joi.number().integer().min(1).max(31).required(),
      month: Joi.number().integer().min(1).max(12).required(),
      year: Joi.number().integer().min(2000).max(2100).required(),
      service_id: Joi.string().uuid().required(),
    },
  }),
  anyProviderDayAvailabilityController.index,
);
providersRouter.get(
  '/:provider_id/month-availability',
  celebrate({
    [Segments.PARAMS]: {
      provider_id: Joi.string().uuid().required(),
    },
    [Segments.QUERY]: {
      month: Joi.number().integer().min(1).max(12).required(),
      year: Joi.number().integer().min(2000).max(2100).required(),
      service_id: Joi.string().uuid(),
    },
  }),
  providerMonthAvailabilityController.index,
);
providersRouter.get(
  '/:provider_id/day-availability',
  celebrate({
    [Segments.PARAMS]: {
      provider_id: Joi.string().uuid().required(),
    },
    // A duração vem do serviço (agendar) ou do agendamento (remarcar)
    [Segments.QUERY]: Joi.object({
      day: Joi.number().integer().min(1).max(31).required(),
      month: Joi.number().integer().min(1).max(12).required(),
      year: Joi.number().integer().min(2000).max(2100).required(),
      service_id: Joi.string().uuid(),
      appointment_id: Joi.string().uuid(),
    }).xor('service_id', 'appointment_id'),
  }),
  providerDayAvailabilityController.index,
);
// Um serviço cabe exatamente neste horário? (ex.: horário clicado na agenda)
providersRouter.get(
  '/:provider_id/slot',
  celebrate({
    [Segments.PARAMS]: {
      provider_id: Joi.string().uuid().required(),
    },
    [Segments.QUERY]: {
      service_id: Joi.string().uuid().required(),
      date: Joi.date().iso().required(),
    },
  }),
  providerSlotController.show,
);
// O serviço não coube no horário: horários livres mais próximos com o mesmo
// barbeiro e outros barbeiros livres no mesmo horário
providersRouter.get(
  '/:provider_id/suggestions',
  celebrate({
    [Segments.PARAMS]: {
      provider_id: Joi.string().uuid().required(),
    },
    [Segments.QUERY]: {
      service_id: Joi.string().uuid().required(),
      date: Joi.date().iso().required(),
    },
  }),
  providerSuggestionsController.index,
);

export default providersRouter;
