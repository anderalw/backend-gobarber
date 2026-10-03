import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensurePermission from '@shared/infra/http/middlewares/ensurePermission';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import WhatsAppController from '../controllers/WhatsAppController';

const whatsappRouter = Router();
const controller = new WhatsAppController();

const id = { [Segments.PARAMS]: { id: Joi.string().uuid().required() } };

whatsappRouter.use(ensureAuthenticated);
whatsappRouter.use(ensureRole('provider'));

// Configuração (admin): forma de envio e quais mensagens
whatsappRouter.get(
  '/settings',
  ensurePermission('settings'),
  controller.settings,
);
whatsappRouter.put(
  '/settings',
  ensurePermission('settings'),
  celebrate({
    [Segments.BODY]: {
      provider: Joi.string().max(40).allow('', null),
      credentials: Joi.object()
        .pattern(Joi.string().max(40), Joi.string().max(500).allow(''))
        .max(10),
      groups: Joi.array()
        .items(
          Joi.string().valid(
            'reminder',
            'appointments',
            'waitlist',
            'membership',
          ),
        )
        .max(4)
        .required(),
    },
  }),
  controller.updateSettings,
);

// Fila do envio assistido e histórico (toda a equipe)
whatsappRouter.get(
  '/messages',
  ensurePermission('whatsapp'),
  celebrate({
    [Segments.QUERY]: { list: Joi.string().valid('pending', 'history') },
  }),
  controller.index,
);
whatsappRouter.get(
  '/messages/count',
  ensurePermission('whatsapp'),
  controller.count,
);
whatsappRouter.post(
  '/messages/:id/sent',
  ensurePermission('whatsapp'),
  celebrate(id),
  controller.sent,
);
whatsappRouter.post(
  '/messages/:id/skip',
  ensurePermission('whatsapp'),
  celebrate(id),
  controller.skip,
);

export default whatsappRouter;
