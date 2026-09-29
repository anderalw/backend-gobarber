import { Router } from 'express';
import { celebrate, Segments, Joi } from 'celebrate';

import ConfirmationsController from '../controllers/ConfirmationsController';

const confirmationsRouter = Router();
const confirmationsController = new ConfirmationsController();

// Público: o cliente chega pelo link do e-mail, sem login. O token é
// secreto e único por agendamento
confirmationsRouter.post(
  '/:token',
  celebrate({
    [Segments.PARAMS]: { token: Joi.string().hex().length(48).required() },
  }),
  confirmationsController.create,
);

export default confirmationsRouter;
