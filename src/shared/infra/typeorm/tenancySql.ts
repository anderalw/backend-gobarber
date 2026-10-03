/* eslint-disable no-restricted-syntax, no-await-in-loop, no-use-before-define */
// (as alterações de estrutura rodam uma por vez, na ordem)
import { QueryRunner } from 'typeorm';

// Peças de SQL do isolamento por barbearia, para as migrations. Toda tabela
// nova precisa de enableTenancy (o servidor não sobe sem isso)

export const APP_ROLE = process.env.DB_APP_ROLE || 'pontual_app';

// Barbearia da conexão (vazio = nenhuma)
const CURRENT = "nullif(current_setting('app.tenant_id', true), '')::uuid";
const PLATFORM = "current_setting('app.platform', true) = 'on'";

function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// Papel sem privilégios de administrador com que a API consulta o banco
export async function ensureAppRole(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE ${quote(APP_ROLE)} NOLOGIN NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$`);
  // O usuário da conexão pode assumir o papel (SET ROLE)
  await queryRunner.query(`GRANT ${quote(APP_ROLE)} TO CURRENT_USER`);
  await queryRunner.query(`GRANT USAGE ON SCHEMA public TO ${quote(APP_ROLE)}`);
  await queryRunner.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quote(
      APP_ROLE,
    )}`,
  );
  await queryRunner.query(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quote(
      APP_ROLE,
    )}`,
  );
  // Tabelas criadas depois pelas migrations já nascem com acesso
  await queryRunner.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quote(
      APP_ROLE,
    )}`,
  );
  await queryRunner.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${quote(
      APP_ROLE,
    )}`,
  );
}

// Coluna tenant_id (preenchida sozinha com a barbearia da conexão) e a regra
// que só deixa ver e gravar as linhas da barbearia atual. Com "fill", as
// linhas que já existem vão para essa barbearia
export async function enableTenancy(
  queryRunner: QueryRunner,
  table: string,
  fill?: string,
): Promise<void> {
  const t = quote(table);

  await queryRunner.query(`ALTER TABLE ${t} ADD COLUMN "tenant_id" uuid`);

  if (fill) {
    await queryRunner.query(`UPDATE ${t} SET "tenant_id" = $1`, [fill]);
  }

  await queryRunner.query(
    `ALTER TABLE ${t}
       ALTER COLUMN "tenant_id" SET DEFAULT ${CURRENT},
       ALTER COLUMN "tenant_id" SET NOT NULL,
       ADD CONSTRAINT ${quote(`FK_${table}_tenant`)}
         FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE`,
  );
  await queryRunner.query(
    `CREATE INDEX ${quote(`IDX_${table}_tenant`)} ON ${t} ("tenant_id")`,
  );

  await scopeUniques(queryRunner, table);

  await queryRunner.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
  await queryRunner.query(
    `CREATE POLICY "tenant_isolation" ON ${t}
       USING ("tenant_id" = ${CURRENT} OR ${PLATFORM})
       WITH CHECK ("tenant_id" = ${CURRENT} OR ${PLATFORM})`,
  );
}

// O que era único na instalação passa a ser único por barbearia (o mesmo
// e-mail pode existir em duas barbearias, cada uma tem o seu caixa do dia...)
async function scopeUniques(
  queryRunner: QueryRunner,
  table: string,
): Promise<void> {
  const t = quote(table);

  // Restrições UNIQUE: recriadas com o tenant_id na frente
  const constraints: Array<{ name: string; columns: string[] }> =
    await queryRunner.query(
      `SELECT con.conname AS name,
              array_agg(att.attname ORDER BY k.ord)::text[] AS columns
         FROM pg_constraint con
         JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
         JOIN pg_attribute att
           ON att.attrelid = con.conrelid AND att.attnum = k.attnum
        WHERE con.conrelid = $1::regclass AND con.contype = 'u'
        GROUP BY con.conname`,
      [table],
    );

  for (const { name, columns } of constraints) {
    if (!columns.includes('tenant_id')) {
      await queryRunner.query(
        `ALTER TABLE ${t} DROP CONSTRAINT ${quote(name)}`,
      );
      await queryRunner.query(
        `ALTER TABLE ${t} ADD CONSTRAINT ${quote(
          name,
        )} UNIQUE ("tenant_id", ${columns.map(quote).join(', ')})`,
      );
    }
  }

  // Chave primária natural (ex.: settings.key): passa a incluir a barbearia
  const [primary]: Array<{ name: string; columns: string[] }> =
    await queryRunner.query(
      `SELECT con.conname AS name,
              array_agg(att.attname ORDER BY k.ord)::text[] AS columns
         FROM pg_constraint con
         JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
         JOIN pg_attribute att
           ON att.attrelid = con.conrelid AND att.attnum = k.attnum
        WHERE con.conrelid = $1::regclass AND con.contype = 'p'
        GROUP BY con.conname`,
      [table],
    );

  const [{ uuidKey }]: Array<{ uuidKey: boolean }> = await queryRunner.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
          AND column_name = $2 AND data_type = 'uuid'
     ) AS "uuidKey"`,
    [table, primary?.columns[0] ?? ''],
  );

  // Chaves uuid já são únicas no mundo todo; as outras não
  if (primary && !uuidKey && !primary.columns.includes('tenant_id')) {
    await queryRunner.query(
      `ALTER TABLE ${t} DROP CONSTRAINT ${quote(primary.name)}`,
    );
    await queryRunner.query(
      `ALTER TABLE ${t} ADD CONSTRAINT ${quote(
        primary.name,
      )} PRIMARY KEY ("tenant_id", ${primary.columns.map(quote).join(', ')})`,
    );
  }

  // Índices únicos avulsos (sem restrição por trás), inclusive os de
  // expressão (ex.: lower(name)): o tenant_id entra como primeira coluna
  const indexes: Array<{ name: string; definition: string }> =
    await queryRunner.query(
      `SELECT i.relname AS name, pg_get_indexdef(ix.indexrelid) AS definition
         FROM pg_index ix
         JOIN pg_class i ON i.oid = ix.indexrelid
        WHERE ix.indrelid = $1::regclass
          AND ix.indisunique AND NOT ix.indisprimary
          AND NOT EXISTS (
            SELECT 1 FROM pg_constraint con WHERE con.conindid = ix.indexrelid
          )`,
      [table],
    );

  for (const { name, definition } of indexes) {
    if (!/\btenant_id\b/.test(definition)) {
      await queryRunner.query(`DROP INDEX ${quote(name)}`);
      await queryRunner.query(
        definition.replace(/ USING (\w+) \(/, ' USING $1 (tenant_id, '),
      );
    }
  }
}
