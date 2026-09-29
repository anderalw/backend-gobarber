import 'reflect-metadata';
import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { isCelebrateError } from 'celebrate';
import 'express-async-errors';

import uploadConfig from '@config/upload';
import AppError from '@shared/errors/AppError';
import connectDatabases from '@shared/infra/typeorm';
import rateLimiter from './middlewares/rateLimiter';
import validationMessage from './validationMessage';
import routes from './routes';
import '@shared/container';

const app = express();

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
  .then(() => {
    app.listen(3333, () => {
      console.log(' Server Started on port 3333!');
    });
  })
  .catch(err => {
    console.error('Não foi possível conectar aos bancos de dados:', err);
    process.exit(1);
  });
