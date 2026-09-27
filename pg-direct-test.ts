// @ts-nocheck
const net = require('net');

const origSocketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args: any[]) {
  console.log('>>> Socket.prototype.connect() chamado com args:', JSON.stringify(args[0] || args));

  const origWrite = this.write.bind(this);
  this.write = (chunk: any, ...rest: any[]) => {
    console.log('>>> ENVIADO (', chunk.length, 'bytes):', Buffer.from(chunk).toString('hex'));
    return origWrite(chunk, ...rest);
  };

  this.on('data', (data: Buffer) => {
    console.log('>>> RECEBIDO (', data.length, 'bytes):', data.toString('hex'));
  });
  this.on('connect', () => console.log('>>> socket: evento "connect" disparou'));
  this.on('close', (hadError: boolean) => console.log('>>> socket: fechou. hadError =', hadError));
  this.on('error', (e: Error) => console.log('>>> socket: erro ->', e.message));
  this.on('lookup', (err: any, address: string, family: any, host: string) =>
    console.log('>>> DNS lookup:', { err: err && err.message, address, family, host })
  );

  return origSocketConnect.apply(this, args);
};

const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'docker',
  database: 'postgres',
  connectionTimeoutMillis: 6000,
});

console.log('>>> Chamando client.connect()...');

client.connect().then(() => {
  console.log('>>> CONECTOU!');
  process.exit(0);
}).catch(err => {
  console.error('>>> ERRO:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('>>> WATCHDOG final: nada resolveu em 9s.');
  process.exit(2);
}, 9000);
