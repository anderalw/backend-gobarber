import 'reflect-metadata';
import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { isCelebrateError, Joi } from 'celebrate';
import 'express-async-errors';
import { container } from 'tsyringe';

import uploadConfig from '@config/upload';
import AppError from '@shared/errors/AppError';
import connectDatabases from '@shared/infra/typeorm';
import startJobs from '@shared/infra/jobs';
import EnsureFirstAdminService from '@modules/users/services/EnsureFirstAdminService';
import rateLimiter from './middlewares/rateLimiter';
import validationMessage from './validationMessage';
import routes from './routes';
import '@shared/container';

const app = express();

// Atrás de um proxy (o nginx do Docker), o IP do cliente vem no
// X-Forwarded-For; sem isso o limite de requisições valeria para todos
// juntos. Só com TRUST_PROXY definido: sem proxy, o cabeçalho seria forjável
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}

app.use(cors());
app.use(express.json());
app.use('/files', express.static(uploadConfig.uploadsFolder));
app.use(rateLimiter);
app.use(routes);

app.use((err: Error, request: Request, response: Response, _: NextFunction) => {
  // Validação dos campos (celebrate): o motivo em português, no mesmo
  // formato dos erros de negócio, para o front mostrar a mensagem
  if (isCelebrateError(err)) {
    const [detail] = Array.from(err.details.values()).flatMap(
      joiError => joiError.details,
    );

    return response.status(400).json({
      status: 'error',
      message: detail ? validationMessage(detail) : 'Dados inválidos.',
    });
  }

  if (err instanceof AppError) {
    return response.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  console.error(err);

  return response.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
});

// Só aceita requisições depois de conectar aos bancos
connectDatabases()
  .then(async () => {
    // Ambiente novo: cria o primeiro administrador (ADMIN_* no .env). O
    // e-mail passa pela mesma regra do login, senão ele não conseguiria entrar
    const adminEmail = process.env.ADMIN_EMAIL;

    if (adminEmail && Joi.string().email().validate(adminEmail).error) {
      throw new Error(`ADMIN_EMAIL inválido: ${adminEmail}`);
    }

    const admin = await container.resolve(EnsureFirstAdminService).execute({
      name: process.env.ADMIN_NAME,
      email: adminEmail,
      password: process.env.ADMIN_PASSWORD,
    });

    if (admin) console.log(` Primeiro administrador criado: ${admin}`);

    const port = Number(process.env.PORT || 3333);

    app.listen(port, () => {
      console.log(` Server Started on port ${port}!`);
    });

    // Pedidos de confirmação da véspera, de tempos em tempos
    startJobs();
  })
  .catch(err => {
    console.error('Não foi possível iniciar o servidor:', err);
    process.exit(1);
  });
