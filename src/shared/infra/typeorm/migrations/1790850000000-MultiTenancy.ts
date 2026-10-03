import { MigrationInterface, QueryRunner } from 'typeorm';

import { ensureAppRole, enableTenancy } from '../tenancySql';

// Todas as tabelas da barbearia (as de antes desta migration)
const TABLES = [
  'users',
  'user_tokens',
  'provider_schedules',
  'clients',
  'services',
  'settings',
  'appointment_series',
  'appointments',
  'block_reasons',
  'time_blocks',
  'recurring_time_blocks',
  'waitlist_entries',
  'cash_closings',
  'card_charges',
  'terminal_devices',
  'membership_plans',
  'memberships',
  'membership_payments',
  'whatsapp_messages',
];

// Várias barbearias no mesmo banco. Os dados que já existem ficam numa
// barbearia criada aqui (DEFAULT_TENANT, ou "principal")
export default class MultiTenancy1790850000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "slug" varchar NOT NULL UNIQUE,
        "name" varchar NOT NULL,
        "custom_domain" varchar UNIQUE,
        "status" varchar NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);

    const existing = await Promise.all(
      ['users', 'clients', 'appointments', 'settings'].map(table =>
        queryRunner.query(`SELECT 1 FROM "${table}" LIMIT 1`),
      ),
    );

    let fill: string | undefined;

    if (existing.some(rows => rows.length > 0)) {
      const [shop] = await queryRunner.query(
        "SELECT value FROM settings WHERE key = 'shop_name'",
      );
      const slug = (process.env.DEFAULT_TENANT || 'principal').toLowerCase();

      const [tenant] = await queryRunner.query(
        'INSERT INTO tenants (slug, name) VALUES ($1, $2) RETURNING id',
        [slug, process.env.DEFAULT_TENANT_NAME || shop?.value || 'Barbearia'],
      );

      fill = tenant.id;
    }

    for (const table of TABLES) {
      await enableTenancy(queryRunner, table, fill);
    }

    await ensureAppRole(queryRunner);
  }

  public async down(): Promise<void> {
    // Voltar juntaria os dados de todas as barbearias numa só
    throw new Error(
      'A migration de várias barbearias não tem volta: restaure um backup.',
    );
  }
}
