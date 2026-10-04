import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensurePermission from '@shared/infra/http/middlewares/ensurePermission';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import receiveImage from '@shared/infra/http/middlewares/receiveImage';
import AgendaSettingsController from '../controllers/AgendaSettingsController';
import NoShowPolicyController from '../controllers/NoShowPolicyController';
import BrandingController from '../controllers/BrandingController';
import ProfileFieldsController from '../controllers/ProfileFieldsController';

const settingsRouter = Router();
const agendaSettingsController = new AgendaSettingsController();
const noShowPolicyController = new NoShowPolicyController();
const brandingController = new BrandingController();
const profileFieldsController = new ProfileFieldsController();

// Identidade da barbearia: pública (o site e o login usam antes de entrar)
settingsRouter.get('/branding', brandingController.show);

// Campos dos cadastros: públicos também (o cadastro do site usa)
settingsRouter.get('/profile-fields', profileFieldsController.show);

settingsRouter.use(ensureAuthenticated);

const onlyAdmin = [ensureRole('provider'), ensurePermission('settings')];

settingsRouter.put(
  '/branding',
  ...onlyAdmin,
  celebrate({
    [Segments.BODY]: {
      name: Joi.string().trim().min(2).max(40).required(),
      primary_color: Joi.string()
        .pattern(/^#[0-9a-fA-F]{6}$/)
        .required(),
    },
  }),
  brandingController.update,
);

// Termos das telas (o padrão vem do ramo de negócio)
const term = Joi.string().trim().max(40).allow('', null);

settingsRouter.put(
  '/vocabulary',
  ...onlyAdmin,
  celebrate({
    [Segments.BODY]: {
      professional: term,
      professionals: term,
      client: term,
      clients: term,
      place: term,
      place_gender: Joi.string().valid('f', 'm', '').allow(null),
      club: term,
    },
  }),
  brandingController.updateVocabulary,
);

settingsRouter.patch(
  '/branding/logo',
  ...onlyAdmin,
  receiveImage('logo', 2),
  brandingController.updateLogo,
);

settingsRouter.delete(
  '/branding/logo',
  ...onlyAdmin,
  brandingController.removeLogo,
);

settingsRouter.get('/agenda', agendaSettingsController.show);

settingsRouter.put(
  '/agenda',
  ensureRole('provider'),
  ensurePermission('settings'),
  celebrate({
    [Segments.BODY]: { buffer_minutes: Joi.number().integer().required() },
  }),
  agendaSettingsController.update,
);

// Faltas a partir das quais o cliente fica com alerta (e se ele ainda pode
// agendar pelo site)
settingsRouter.get(
  '/no-show',
  ensureRole('provider'),
  noShowPolicyController.show,
);

settingsRouter.put(
  '/no-show',
  ensureRole('provider'),
  ensurePermission('settings'),
  celebrate({
    [Segments.BODY]: {
      alert_threshold: Joi.number().integer().min(0).max(10).required(),
      block_online: Joi.boolean().required(),
    },
  }),
  noShowPolicyController.update,
);

const fieldRules = (fields: string[]) =>
  Joi.object(
    Object.fromEntries(
      fields.map(field => [
        field,
        Joi.object({
          show: Joi.boolean().required(),
          required: Joi.boolean().required(),
        }),
      ]),
    ),
  ).required();

settingsRouter.put(
  '/profile-fields',
  ...onlyAdmin,
  celebrate({
    [Segments.BODY]: {
      client_site: fieldRules(['cpf', 'birth_date', 'address']),
      client_counter: fieldRules(['email', 'cpf', 'birth_date', 'address']),
      staff: fieldRules(['phone', 'cpf', 'birth_date', 'address']),
    },
  }),
  profileFieldsController.update,
);

export default settingsRouter;
