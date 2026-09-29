import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureAdmin from '@shared/infra/http/middlewares/ensureAdmin';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import receiveImage from '@shared/infra/http/middlewares/receiveImage';
import SiteController from '../controllers/SiteController';

const siteRouter = Router();
const siteController = new SiteController();

// Página inicial: pública (visitantes, antes de entrar)
siteRouter.get('/', siteController.show);

const onlyAdmin = [ensureAuthenticated, ensureRole('provider'), ensureAdmin];

siteRouter.put(
  '/',
  ...onlyAdmin,
  celebrate({
    [Segments.BODY]: {
      tagline: Joi.string().max(120).allow('', null),
      about: Joi.string().max(1000).allow('', null),
      address: Joi.string().max(200).allow('', null),
      whatsapp: Joi.string().max(30).allow('', null),
      instagram: Joi.string().max(100).allow('', null),
    },
  }),
  siteController.update,
);

// Foto da capa: até 5 MB
siteRouter.patch(
  '/cover',
  ...onlyAdmin,
  receiveImage('cover', 5),
  siteController.updateCover,
);

siteRouter.delete('/cover', ...onlyAdmin, siteController.removeCover);

export default siteRouter;
