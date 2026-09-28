import { SignOptions } from 'jsonwebtoken';

// Sem APP_SECRET os tokens seriam assinados com um valor conhecido e
// qualquer pessoa conseguiria forjar um login; melhor nem subir o servidor.
// Nos testes (Jest define NODE_ENV=test) basta um valor fixo.
const secret =
  process.env.APP_SECRET ||
  (process.env.NODE_ENV === 'test' ? 'test-secret' : undefined);

if (!secret) {
  throw new Error(
    'APP_SECRET não definido: configure-o no .env (ver .env.example).',
  );
}

const expiresIn: SignOptions['expiresIn'] = '1d';

export default {
  jwt: {
    secret,
    expiresIn,
    // Só aceita tokens assinados com o algoritmo que o próprio backend usa
    algorithm: 'HS256' as const,
  },
};
