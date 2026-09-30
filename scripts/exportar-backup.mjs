#!/usr/bin/env node
// Gera um backup completo de uma instalação do GoBarber, no formato que o
// painel do SaaS importa (e que ele mesmo gera): um .tar.gz com
//
//   manifest.json   formato, data e (opcional) o APP_SECRET
//   postgres.sql    pg_dump do banco principal
//   mongo.archive   mongodump das notificações (se houver MongoDB)
//   files/          fotos enviadas (logo, capa, avatares)
//
// Uso (na pasta do backend):
//   node scripts/exportar-backup.mjs --out barbearia.tar.gz
//
// Opções (os padrões são os do ambiente de desenvolvimento):
//   --postgres <contêiner>   gobarber-postgres
//   --mongo <contêiner>      gobarber-mongo   ("" = sem MongoDB)
//   --uploads <pasta>        tmp/uploads
//   --db <nome>              gostack_gobarber
//   --db-user <usuário>      postgres
//   --env <arquivo>          .env (de onde vem o APP_SECRET)
//   --sem-segredo            não inclui o APP_SECRET no backup
//
// Numa instalação com o deploy/docker-compose.yml, os contêineres se chamam
// gobarber-postgres-1 e gobarber-mongo-1, e as fotos ficam no volume
// "files" (copie com: docker cp gobarber-api-1:/app/tmp/uploads ./uploads).
//
// ATENÇÃO: o backup tem todos os dados da barbearia (e o segredo do
// sistema): guarde com o mesmo cuidado de uma senha.
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);

function option(name, fallback) {
  const index = args.indexOf(`--${name}`);

  return index >= 0 ? args[index + 1] ?? '' : fallback;
}

const out = option('out', `backup-gobarber-${new Date().toISOString().slice(0, 10)}.tar.gz`);
const postgres = option('postgres', 'gobarber-postgres');
const mongo = option('mongo', 'gobarber-mongo');
const uploads = option('uploads', path.join('tmp', 'uploads'));
const database = option('db', 'gostack_gobarber');
const dbUser = option('db-user', 'postgres');
const envFile = option('env', '.env');
const withSecret = !args.includes('--sem-segredo');

// Pasta de trabalho relativa (o tar do Windows e o do Git Bash entendem)
const work = `.backup-${Date.now()}`;

// Roda um comando e grava a saída (binária) num arquivo
function toFile(command, commandArgs, file) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stream = fs.createWriteStream(file);
    let errors = '';

    child.stdout.pipe(stream);
    child.stderr.on('data', chunk => {
      errors += chunk;
    });
    child.on('close', code => {
      stream.close();

      if (code === 0) resolve();
      else reject(new Error(`${command} ${commandArgs.join(' ')} falhou:\n${errors}`));
    });
  });
}

function readSecret() {
  if (!withSecret || !fs.existsSync(envFile)) return undefined;

  const line = fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .find(item => item.startsWith('APP_SECRET='));

  return line ? line.slice('APP_SECRET='.length).trim().replace(/^"|"$/g, '') : undefined;
}

async function main() {
  fs.mkdirSync(path.join(work, 'files'), { recursive: true });

  try {
    console.log(`Banco principal (${postgres})...`);
    await toFile(
      'docker',
      ['exec', postgres, 'pg_dump', '-U', dbUser, '-d', database, '--no-owner', '--no-acl'],
      path.join(work, 'postgres.sql'),
    );

    if (mongo) {
      console.log(`Notificações (${mongo})...`);
      await toFile(
        'docker',
        ['exec', mongo, 'mongodump', '--archive', '--db', database, '--quiet'],
        path.join(work, 'mongo.archive'),
      );
    }

    if (fs.existsSync(uploads)) {
      console.log(`Fotos (${uploads})...`);
      fs.cpSync(uploads, path.join(work, 'files'), { recursive: true });
    }

    const secret = readSecret();

    fs.writeFileSync(
      path.join(work, 'manifest.json'),
      JSON.stringify(
        {
          format: 'gobarber-backup',
          version: 1,
          created_at: new Date().toISOString(),
          source: 'exportar-backup.mjs',
          ...(secret ? { app_secret: secret } : {}),
        },
        null,
        2,
      ),
    );

    execFileSync('tar', ['-czf', path.relative(work, out), '.'], { cwd: work });

    const size = (fs.statSync(out).size / 1024 / 1024).toFixed(1);

    console.log(`Backup pronto: ${out} (${size} MB)${secret ? ' — inclui o APP_SECRET' : ''}`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
