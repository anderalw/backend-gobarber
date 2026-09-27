console.log('>>> PASSO 1: processo iniciado');

setTimeout(() => {
  console.log('>>> PASSO 2: passaram-se 3 segundos, o processo continua vivo');
  console.log('>>> Node version:', process.version);
  console.log('>>> Plataforma:', process.platform);
  console.log('>>> PASSO 3: finalizando com sucesso');
  process.exit(0);
}, 3000);
