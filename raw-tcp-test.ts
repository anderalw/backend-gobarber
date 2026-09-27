import * as net from 'net';

console.log('>>> Conectando e enviando pacote inicial do protocolo Postgres (SSL request)...');

const socket = net.createConnection({ host: '127.0.0.1', port: 5432 }, () => {
  console.log('>>> Socket TCP conectado. Enviando SSLRequest...');

  // Pacote padrão que o driver "pg" manda primeiro: tamanho (8) + código mágico do SSLRequest
  const sslRequest = Buffer.from([0x00, 0x00, 0x00, 0x08, 0x04, 0xd2, 0x16, 0x2f]);
  socket.write(sslRequest);
});

socket.setTimeout(5000);

let respondeu = false;

socket.on('data', data => {
  respondeu = true;
  console.log('>>> RESPOSTA RECEBIDA DO POSTGRES:', data);
  console.log('>>> Como texto:', data.toString('utf8'));
  console.log('>>> ISSO É ÓTIMO: o Postgres está respondendo ao protocolo normalmente.');
  socket.end();
  process.exit(0);
});

socket.on('error', err => {
  console.error('>>> ERRO no socket:');
  console.error(err);
  process.exit(1);
});

socket.on('timeout', () => {
  if (!respondeu) {
    console.error('>>> TIMEOUT: conectou no TCP mas o Postgres NUNCA respondeu ao pacote do protocolo.');
    console.error('>>> Isso indica que o Docker Desktop está repassando a conexão (handshake) mas não os dados seguintes.');
  }
  socket.destroy();
  process.exit(2);
});