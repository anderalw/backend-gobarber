/* eslint-disable no-restricted-syntax, no-await-in-loop, no-use-before-define */
// (as tabelas são copiadas uma por vez, na ordem das chaves estrangeiras)
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { container } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import authConfig from '@config/auth';
import uploadConfig from '@config/upload';
import dataSource from '@shared/infra/typeorm/dataSource';
import mongoDataSource from '@shared/infra/typeorm/mongoDataSource';
import { runWithTenant } from '@shared/tenancy/TenantContext';
import { reseal } from '@shared/utils/secretBox';
import Notification from '@modules/notifications/infra/typeorm/schemas/Notification';
import TenantsService from '@modules/tenants/services/TenantsService';
import ITenantsRepository from '@modules/tenants/repositories/ITenantsRepository';
import Tenant from '../typeorm/entities/Tenant';

// Backup de UMA barbearia (formato gobarber-backup, versão 2): um .tar.gz
//
//   manifest.json          formato, a barbearia e o APP_SECRET de origem
//   tables/<tabela>.ndjson as linhas dela, uma por linha (row_to_json)
//   notifications.ndjson   as notificações (MongoDB)
//   files/                 as fotos citadas nos dados (logo, capa, avatares)
//
// Serve para guardar, restaurar e mudar a barbearia de instalação. A
// versão 1 era o banco inteiro de uma instalação de uma barbearia só.

const FORMAT = 'gobarber-backup';
const VERSION = 2;
const BATCH = 500;

// Nome que o upload dá às fotos: 20 hexadecimais + o nome original
const FILE_NAME = /\b[0-9a-f]{20}-[\w.-]+/g;

// Segredos cifrados nas configurações: { prefixo da chave: uso da cifra }
const SEALED_SETTINGS: Record<string, string> = {
  'terminal_credentials:': 'terminal-credentials',
  'whatsapp_credentials:': 'whatsapp-credentials',
};

interface IManifest {
  format: string;
  version: number;
  created_at: string;
  app_secret?: string;
  tenant: { slug: string; name: string; custom_domain: string | null };
  tables: string[];
}

function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// O tar roda na pasta temporária, com caminhos relativos: o tar do Git no
// Windows entenderia "C:" como outro computador
function tar(...args: string[]): Promise<void> {
  const cwd = os.tmpdir();
  const relative = args.map(arg =>
    path.isAbsolute(arg) ? path.relative(cwd, arg) || '.' : arg,
  );

  return new Promise((resolve, reject) => {
    const child = spawn('tar', relative, {
      cwd,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let errors = '';

    child.stderr.on('data', chunk => {
      errors += chunk;
    });
    child.on('error', reject);
    child.on('close', code =>
      code === 0
        ? resolve()
        : reject(new Error(`tar falhou: ${errors.trim()}`)),
    );
  });
}

// Tabelas da barbearia (as que têm tenant_id), mães antes das filhas
async function tenantTables(): Promise<string[]> {
  const tables: Array<{ name: string }> = await dataSource.query(
    `SELECT table_name AS name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'tenant_id'
      ORDER BY table_name`,
  );
  const links: Array<{ child: string; parent: string }> =
    await dataSource.query(
      `SELECT c.relname AS child, p.relname AS parent
         FROM pg_constraint con
         JOIN pg_class c ON c.oid = con.conrelid
         JOIN pg_class p ON p.oid = con.confrelid
        WHERE con.contype = 'f' AND con.conrelid <> con.confrelid`,
    );

  const names = tables.map(table => table.name);
  const ordered: string[] = [];
  const visiting = new Set<string>();

  const visit = (table: string): void => {
    if (ordered.includes(table) || visiting.has(table)) return;

    visiting.add(table);
    links
      .filter(link => link.child === table && names.includes(link.parent))
      .forEach(link => visit(link.parent));
    visiting.delete(table);
    ordered.push(table);
  };

  names.forEach(visit);

  return ordered;
}

async function temporaryFolder(prefix: string): Promise<string> {
  return fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
}

// Gera o backup da barbearia; devolve o caminho do .tar.gz (quem chama
// apaga depois de usar)
export async function exportTenant(tenant: Tenant): Promise<string> {
  const work = await temporaryFolder('pontual-export-');
  const files = new Set<string>();
  const tables = await tenantTables();

  try {
    await fs.promises.mkdir(path.join(work, 'tables'));

    await runWithTenant(tenant, async () => {
      for (const table of tables) {
        const rows: Array<{ row: string }> = await dataSource.query(
          `SELECT row_to_json(t)::text AS row FROM ${quote(table)} t`,
        );

        rows.forEach(({ row }) =>
          (row.match(FILE_NAME) || []).forEach(name => files.add(name)),
        );

        await fs.promises.writeFile(
          path.join(work, 'tables', `${table}.ndjson`),
          rows.map(({ row }) => `${row}\n`).join(''),
        );
      }
    });

    const notifications = await mongoDataSource
      .getMongoRepository(Notification)
      .find({ where: { tenant_id: tenant.id } });

    await fs.promises.writeFile(
      path.join(work, 'notifications.ndjson'),
      notifications
        .map(({ id: _id, tenant_id: _tenant, ...rest }) => JSON.stringify(rest))
        .map(line => `${line}\n`)
        .join(''),
    );

    // Com S3 as fotos já estão fora do servidor
    if (uploadConfig.driver !== 's3') {
      await fs.promises.mkdir(path.join(work, 'files'));

      for (const name of Array.from(files)) {
        const source = path.join(uploadConfig.uploadsFolder, name);

        if (fs.existsSync(source)) {
          await fs.promises.copyFile(source, path.join(work, 'files', name));
        }
      }
    }

    const manifest: IManifest = {
      format: FORMAT,
      version: VERSION,
      created_at: new Date().toISOString(),
      // Para a maquininha e o WhatsApp continuarem conectados em outra
      // instalação (as credenciais são cifradas com ele)
      app_secret: authConfig.jwt.secret,
      tenant: {
        slug: tenant.slug,
        name: tenant.name,
        custom_domain: tenant.custom_domain,
      },
      tables,
    };

    await fs.promises.writeFile(
      path.join(work, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    );

    const archive = path.join(
      os.tmpdir(),
      `pontual-${tenant.slug}-${Date.now()}.tar.gz`,
    );

    await tar('-czf', archive, '-C', work, '.');

    return archive;
  } finally {
    await fs.promises.rm(work, { recursive: true, force: true });
  }
}

async function readLines(file: string): Promise<Record<string, unknown>[]> {
  if (!fs.existsSync(file)) return [];

  return (await fs.promises.readFile(file, 'utf8'))
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

// Credenciais cifradas com o APP_SECRET da instalação de origem
function resealSettings(
  rows: Record<string, unknown>[],
  fromSecret: string | undefined,
): Record<string, unknown>[] {
  if (!fromSecret || fromSecret === authConfig.jwt.secret) return rows;

  return rows.map(row => {
    const key = String(row.key);
    const purpose = Object.entries(SEALED_SETTINGS).find(([prefix]) =>
      key.startsWith(prefix),
    )?.[1];

    if (!purpose) return row;

    // Não abriu: fica como está (a barbearia conecta de novo)
    return {
      ...row,
      value: reseal(String(row.value), purpose, fromSecret) ?? row.value,
    };
  });
}

// Cria uma barbearia nova com os dados do backup
export async function importTenant(
  archive: string,
  options: { slug?: string; name?: string },
): Promise<Tenant> {
  const work = await temporaryFolder('pontual-import-');

  try {
    await tar('-xzf', archive, '-C', work).catch(() => {
      throw new AppError('Arquivo inválido: envie o .tar.gz do backup.');
    });

    let manifest: IManifest;

    try {
      manifest = JSON.parse(
        await fs.promises.readFile(path.join(work, 'manifest.json'), 'utf8'),
      );
    } catch {
      throw new AppError('Backup sem o manifest.json.');
    }

    if (manifest.format !== FORMAT || manifest.version !== VERSION) {
      throw new AppError(
        manifest.version === 1
          ? 'Backup de uma instalação antiga (versão 1): importe pelo painel.'
          : 'Formato de backup desconhecido.',
      );
    }

    const tenant = await container.resolve(TenantsService).register({
      slug: options.slug || manifest.tenant.slug,
      name: options.name || manifest.tenant.name,
      custom_domain: manifest.tenant.custom_domain,
    });

    try {
      await copyRows(tenant, work, manifest);
    } catch (err) {
      await container
        .resolve<ITenantsRepository>('TenantsRepository')
        .remove(tenant);

      if ((err as { code?: string }).code === '23505') {
        throw new AppError(
          'Esses dados já existem nesta instalação: a barbearia de origem ainda está aqui?',
        );
      }

      throw err;
    }

    await copyNotifications(tenant, work);
    await copyFiles(work);

    return tenant;
  } finally {
    await fs.promises.rm(work, { recursive: true, force: true });
  }
}

// Tudo numa transação: ou entra a barbearia inteira, ou nada
async function copyRows(
  tenant: Tenant,
  work: string,
  manifest: IManifest,
): Promise<void> {
  const tables = await tenantTables();

  await runWithTenant(tenant, async () => {
    const queryRunner = dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const table of tables) {
        let rows = await readLines(
          path.join(work, 'tables', `${table}.ndjson`),
        );

        if (table === 'settings') {
          rows = resealSettings(rows, manifest.app_secret);
        }

        for (let start = 0; start < rows.length; start += BATCH) {
          const batch = rows
            .slice(start, start + BATCH)
            .map(row => ({ ...row, tenant_id: tenant.id }));

          await queryRunner.query(
            `INSERT INTO ${quote(table)}
               SELECT * FROM jsonb_populate_recordset(NULL::${quote(
                 table,
               )}, $1::jsonb)`,
            [JSON.stringify(batch)],
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  });
}

async function copyNotifications(tenant: Tenant, work: string): Promise<void> {
  const lines = await readLines(path.join(work, 'notifications.ndjson'));

  if (lines.length === 0) return;

  const dates = ['create_at', 'updated_at', 'date'];

  await mongoDataSource.getMongoRepository(Notification).insertMany(
    lines.map(line => {
      const document: Record<string, unknown> = {
        ...line,
        tenant_id: tenant.id,
      };

      dates.forEach(field => {
        if (typeof document[field] === 'string') {
          document[field] = new Date(document[field] as string);
        }
      });

      return document;
    }),
  );
}

async function copyFiles(work: string): Promise<void> {
  const folder = path.join(work, 'files');

  if (!fs.existsSync(folder)) return;

  await fs.promises.mkdir(uploadConfig.uploadsFolder, { recursive: true });

  for (const name of await fs.promises.readdir(folder)) {
    const target = path.join(uploadConfig.uploadsFolder, name);

    if (!fs.existsSync(target)) {
      await fs.promises.copyFile(path.join(folder, name), target);
    }
  }
}
