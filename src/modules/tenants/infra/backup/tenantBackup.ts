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
  // Só na versão 2
  tenant?: { slug: string; name: string; custom_domain: string | null };
  tables?: string[];
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

// Linhas de cada tabela, como vieram do backup
type TableRows = Map<string, Record<string, unknown>[]>;

// Versão 2: um arquivo por tabela
async function rowsV2(work: string, tables: string[]): Promise<TableRows> {
  const result: TableRows = new Map();

  for (const table of tables) {
    result.set(
      table,
      await readLines(path.join(work, 'tables', `${table}.ndjson`)),
    );
  }

  return result;
}

const COPY_ESCAPES: Record<string, string> = {
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

// Texto do COPY do pg_dump: \N é nulo e a barra invertida escapa o resto
function copyValue(raw: string): string | null {
  if (raw === '\\N') return null;

  return raw.replace(
    /\\(x[0-9a-fA-F]{1,2}|[0-7]{1,3}|.)/g,
    (_, code: string) => {
      if (code[0] === 'x')
        return String.fromCharCode(parseInt(code.slice(1), 16));
      if (/^[0-7]/.test(code)) return String.fromCharCode(parseInt(code, 8));

      return COPY_ESCAPES[code] ?? code;
    },
  );
}

// Versão 1: o pg_dump inteiro de uma instalação de uma barbearia só. Lê os
// blocos "COPY tabela (colunas) FROM stdin;" das tabelas da barbearia
async function rowsV1(work: string, tables: string[]): Promise<TableRows> {
  const file = path.join(work, 'postgres.sql');

  if (!fs.existsSync(file)) throw new AppError('Backup sem o postgres.sql.');

  const result: TableRows = new Map(tables.map(table => [table, []]));
  const lines = (await fs.promises.readFile(file, 'utf8')).split('\n');
  let current: { rows: Record<string, unknown>[]; columns: string[] } | null =
    null;

  for (const line of lines) {
    if (current) {
      if (line === '\\.') {
        current = null;
      } else {
        const values = line.split('\t').map(copyValue);
        const { columns } = current;

        current.rows.push(
          Object.fromEntries(
            columns.map((column, index) => [column, values[index]]),
          ),
        );
      }
    } else {
      const copy = /^COPY (?:public\.)?"?(\w+)"? \((.*)\) FROM stdin;$/.exec(
        line,
      );

      if (copy) {
        // Tabela que não é da barbearia (ex.: migrations): lê e descarta
        current = {
          rows: result.get(copy[1]) || [],
          columns: copy[2]
            .split(', ')
            .map(column => column.replace(/^"|"$/g, '')),
        };
      }
    }
  }

  // No COPY, json vem como texto: vira objeto para entrar como json
  for (const table of tables) {
    const jsonColumns: Array<{ name: string }> = await dataSource.query(
      `SELECT column_name AS name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
          AND data_type IN ('json', 'jsonb')`,
      [table],
    );

    (result.get(table) || []).forEach(row => {
      jsonColumns.forEach(({ name }) => {
        if (typeof row[name] === 'string') {
          // eslint-disable-next-line no-param-reassign
          row[name] = JSON.parse(row[name] as string);
        }
      });
    });
  }

  return result;
}

// Cria uma barbearia nova com os dados do backup (versão 2, ou a 1 das
// instalações de uma barbearia só)
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

    if (
      manifest.format !== FORMAT ||
      ![1, VERSION].includes(manifest.version)
    ) {
      throw new AppError('Formato de backup desconhecido.');
    }

    const tables = await tenantTables();
    const rows =
      manifest.version === 1
        ? await rowsV1(work, tables)
        : await rowsV2(work, tables);

    // A versão 1 não diz qual barbearia é: o nome vem das configurações
    const shopName = (rows.get('settings') || []).find(
      row => row.key === 'shop_name',
    )?.value as string | undefined;
    const slug = options.slug || manifest.tenant?.slug;

    if (!slug) {
      throw new AppError('Informe o identificador da barbearia.');
    }

    const tenant = await container.resolve(TenantsService).register({
      slug,
      name: options.name || manifest.tenant?.name || shopName || slug,
      custom_domain: manifest.tenant?.custom_domain,
    });

    try {
      rows.set(
        'settings',
        resealSettings(rows.get('settings') || [], manifest.app_secret),
      );

      await copyRows(tenant, tables, rows);
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

// Tudo numa transação: ou entra a barbearia inteira, ou nada. Só as colunas
// que vieram no backup: as que faltarem (backup de uma versão mais antiga)
// ficam com o valor padrão
async function copyRows(
  tenant: Tenant,
  tables: string[],
  rows: TableRows,
): Promise<void> {
  await runWithTenant(tenant, async () => {
    const queryRunner = dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const table of tables) {
        const tableRows = rows.get(table) || [];
        const existing: Array<{ name: string }> = await queryRunner.query(
          `SELECT column_name AS name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1`,
          [table],
        );
        const known = new Set(existing.map(column => column.name));
        const columns = Array.from(
          new Set(tableRows.flatMap(row => Object.keys(row))),
        ).filter(column => known.has(column) && column !== 'tenant_id');
        const list = columns.map(quote).join(', ');

        for (let start = 0; start < tableRows.length; start += BATCH) {
          await queryRunner.query(
            `INSERT INTO ${quote(table)} (${list}, "tenant_id")
               SELECT ${list}, $2::uuid
                 FROM jsonb_populate_recordset(NULL::${quote(
                   table,
                 )}, $1::jsonb)`,
            [JSON.stringify(tableRows.slice(start, start + BATCH)), tenant.id],
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
