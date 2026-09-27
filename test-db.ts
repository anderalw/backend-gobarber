import 'reflect-metadata';
import { createConnection } from 'typeorm';

process.on('uncaughtException', err => {
  console.error('>>> UNCAUGHT EXCEPTION:');
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  console.error('>>> UNHANDLED REJECTION:');
  console.error(reason);
  process.exit(1);
});

console.log('>>> PASSO 1: import OK');
console.log('>>> typeof createConnection:', typeof createConnection);

try {
  console.log('>>> PASSO 2: chamando createConnection()...');
  const promise = createConnection();
  console.log('>>> PASSO 3: createConnection() retornou. É uma Promise?', promise instanceof Promise);

  promise
    .then(connection => {
      console.log('>>> PASSO 4: CONECTOU! Nome:', connection.name);
      return connection.close();
    })
    .then(() => {
      console.log('>>> PASSO 5: conexão fechada.');
      process.exit(0);
    })
    .catch(err => {
      console.error('>>> PASSO 4 (ERRO): a promise rejeitou:');
      console.error(err);
      process.exit(1);
    });

  console.log('>>> PASSO 3b: .then/.catch anexados, aguardando...');
} catch (syncErr) {
  console.error('>>> ERRO SÍNCRONO ao chamar createConnection():');
  console.error(syncErr);
  process.exit(1);
}

setTimeout(() => {
  console.log('>>> WATCHDOG: 8 segundos se passaram e nada aconteceu (nem sucesso nem erro).');
  console.log('>>> Isso confirma que a promise ficou pendurada para sempre.');
  process.exit(2);
}, 8000);