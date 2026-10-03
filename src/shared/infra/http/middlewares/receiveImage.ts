import { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import uploadConfig from '@config/upload';
import AppError from '@shared/errors/AppError';
import { keepTenant } from '@shared/tenancy/TenantContext';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

// Recebe uma imagem (PNG, JPG, WEBP ou SVG) no campo informado, com limite
// de tamanho; os erros viram mensagens para o usuário
export default function receiveImage(field: string, maxMegabytes: number) {
  const upload = multer({
    ...uploadConfig.multer,
    limits: { fileSize: maxMegabytes * 1024 * 1024 },
    fileFilter(request, file, callback) {
      if (!IMAGE_TYPES.includes(file.mimetype)) {
        callback(Object.assign(new Error('tipo'), { code: 'IMAGE_TYPE' }));
        return;
      }

      callback(null, true);
    },
  }).single(field);

  return keepTenant(
    (request: Request, response: Response, next: NextFunction): void => {
      upload(request, response, err => {
        if (err) {
          const messages: Record<string, string> = {
            IMAGE_TYPE: 'Envie uma imagem PNG, JPG, WEBP ou SVG.',
            LIMIT_FILE_SIZE: `A imagem pode ter no máximo ${maxMegabytes} MB.`,
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
    },
  );
}
