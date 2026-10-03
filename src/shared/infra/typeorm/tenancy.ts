import { DataSource } from 'typeorm';
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner';

import tenancyConfig from '@config/tenancy';
import { currentTenant, isPlatform } from '@shared/tenancy/TenantContext';

// Isolamento das barbearias no próprio banco: toda tabela tem tenant_id e
// uma regra (RLS) que só mostra e só aceita as linhas da barbearia em
// app.tenant_id. Antes de cada consulta, a conexão recebe a barbearia da
// requisição; sem barbearia, o banco não devolve nada (e recusa inserções)

// Tabelas sem tenant_id: a própria lista de barbearias e as do TypeORM
export const PLATFORM_TABLES = ['tenants', 'migrations', 'typeorm_metadata'];

const SESSION_SQL =
  "SELECT set_config('role', $1, false), set_config('app.tenant_id', $2, false), set_config('app.platform', $3, false)";

// Controle de transação: não aceitam outro comando antes (numa transação
// com erro, só o ROLLBACK passa)
const CONTROL = /^\s*(ROLLBACK|COMMIT|END|RELEASE)\b/i;
// Desfazem o que foi definido dentro da transação, inclusive a sessão
const UNDO = /^\s*ROLLBACK\b/i;

const STATE = Symbol('pontual.tenancy');

type Client = {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
  [STATE]?: string;
};

let installed = false;

function sessionValues(): string[] {
  const tenant = currentTenant();

  return [
    tenancyConfig.dbAppRole || 'none',
    tenant?.id ?? '',
    !tenant && isPlatform() ? 'on' : 'off',
  ];
}

// Liga o isolamento nas conexões desta aplicação (o servidor e os scripts;
// as migrations rodam pela CLI, como dono das tabelas)
export function installTenancy(): void {
  if (installed) return;
  installed = true;

  const original = PostgresQueryRunner.prototype.query;

  PostgresQueryRunner.prototype.query = async function query(
    this: PostgresQueryRunner,
    sql: string,
    parameters?: unknown[],
    useStructuredResult?: boolean,
  ) {
    if (!this.isReleased && !CONTROL.test(sql)) {
      const client = (await this.connect()) as Client;
      const values = sessionValues();
      const key = values.join('|');

      // Só reenvia quando muda (a conexão volta para o pool com o último)
      if (client[STATE] !== key) {
        await client.query(SESSION_SQL, values);
        client[STATE] = key;
      }
    }

    try {
      return await original.call(this, sql, parameters, useStructuredResult);
    } finally {
      if (UNDO.test(sql)) {
        const client = this.databaseConnection as Client | undefined;

        if (client) client[STATE] = undefined;
      }
    }
  } as typeof original;
}

// Recusa subir se alguma tabela ficou sem a regra de isolamento (ex.: uma
// migration nova que esqueceu o enableTenancy)
export async function checkTenancy(dataSource: DataSource): Promise<void> {
  const rows: Array<{ table: string }> = await dataSource.query(
    `SELECT c.relname AS table
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND NOT c.relrowsecurity
        AND c.relname <> ALL($1)`,
    [PLATFORM_TABLES],
  );

  if (rows.length > 0) {
    throw new Error(
      `Tabelas sem isolamento por barbearia: ${rows
        .map(row => row.table)
        .join(', ')}. Use enableTenancy na migration.`,
    );
  }
}
