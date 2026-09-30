import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

import authConfig from '@config/auth';

// Segredos de integrações (operadora da maquininha, WhatsApp...) ficam
// cifrados no banco (AES-256-GCM), com uma chave derivada do APP_SECRET e
// do uso: quem ler só o banco não consegue usá-los
const keyFor = (purpose: string): Buffer =>
  createHash('sha256').update(`${authConfig.jwt.secret}:${purpose}`).digest();

export function seal(text: string, purpose: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(purpose), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    data.toString('base64'),
  ].join(':');
}

// undefined: corrompido ou cifrado com outro APP_SECRET
export function open(sealed: string, purpose: string): string | undefined {
  const [version, iv, tag, data] = sealed.split(':');

  if (version !== 'v1' || !iv || !tag || !data) return undefined;

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyFor(purpose),
      Buffer.from(iv, 'base64'),
    );

    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return undefined;
  }
}
