import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { celebrate, Segments, Joi } from 'celebrate';

import ensureAuthenticated from '@modules/users/infra/http/middlewares/ensureAuthenticated';
import ensureAdmin from '@shared/infra/http/middlewares/ensureAdmin';
import ensureRole from '@shared/infra/http/middlewares/ensureRole';
import uploadConfig from '@config/upload';
import AppError from '@shared/errors/AppError';
import AgendaSettingsController from '../controllers/AgendaSettingsController';
import NoShowPolicyController from '../controllers/NoShowPolicyController';
import BrandingController from '../controllers/BrandingController';

const settingsRouter = Router();
const agendaSettingsController = new AgendaSettingsController();
const noShowPolicyController = new NoShowPolicyController();
const brandingController = new BrandingController();

// Logo: só imagens, até 2 MB
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const logoUpload = multer({
  ...uploadConfig.multer,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(request, file, callback) {
    if (!LOGO_TYPES.includes(file.mimetype)) {
      callback(Object.assign(new Error('tipo'), { code: 'LOGO_TYPE' }));
      return;
    }

    callback(null, true);
  },
}).single('logo');

// Erros do upload (tamanho, tipo) como mensagens para o usuário
function receiveLogo(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  logoUpload(request, response, err => {
    if (err) {
      const messages: Record<string, string> = {
        LOGO_TYPE: 'Envie uma imagem PNG, JPG, WEBP ou SVG.',
        LIMIT_FILE_SIZE: 'A imagem pode ter no máximo 2 MB.',
      };

      next(
        new AppError(
          messages[err.code] || 'Não foi possível receber a imagem.',
        ),
      );
      return;
    }

    next();
  });
}

// Identidade da barbearia: pública (o site e o login usam antes de entrar)
settingsRouter.get('/branding', brandingController.show);

settingsRouter.use(ensureAuthenticated);

const onlyAdmin = [ensureRole('provider'), ensureAdmin];

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

settingsRouter.patch(
  '/branding/logo',
  ...onlyAdmin,
  receiveLogo,
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
  ensureAdmin,
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
  ensureAdmin,
  celebrate({
    [Segments.BODY]: {
      alert_threshold: Joi.number().integer().min(0).max(10).required(),
      block_online: Joi.boolean().required(),
    },
  }),
  noShowPolicyController.update,
);

export default settingsRouter;
