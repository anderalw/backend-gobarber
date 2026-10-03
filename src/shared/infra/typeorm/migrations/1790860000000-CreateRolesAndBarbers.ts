import { MigrationInterface, QueryRunner } from 'typeorm';

import { enableTenancy } from '../tenancySql';

// Perfis padrão de cada barbearia (iguais aos de DEFAULT_ROLES)
const RECEPTION = [
  'agenda.all',
  'agenda.manage',
  'clients',
  'cash',
  'club',
  'whatsapp',
];

// Usuário e barbeiro passam a ser coisas separadas: todo usuário da equipe
// tem um perfil de acesso (com permissões) e só quem é barbeiro aparece na
// agenda. Quem já existia continua barbeiro; o admin vira o perfil
// Administrador e os outros, o perfil Barbeiro
export default class CreateRolesAndBarbers1790860000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "permissions" text[] NOT NULL DEFAULT '{}',
        "system_key" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);

    await enableTenancy(queryRunner, 'roles');

    await queryRunner.query(
      'CREATE UNIQUE INDEX "RolesName" ON "roles" ("tenant_id", lower("name"))',
    );

    // Os três perfis em cada barbearia que já existe
    await queryRunner.query(
      `INSERT INTO "roles" ("tenant_id", "name", "permissions", "system_key")
       SELECT t.id, r.name, r.permissions, r.system_key
         FROM "tenants" t
        CROSS JOIN (VALUES
          ('Administrador', '{}'::text[], 'admin'),
          ('Recepção', $1::text[], 'reception'),
          ('Barbeiro', '{}'::text[], 'barber')
        ) AS r(name, permissions, system_key)`,
      [RECEPTION],
    );

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "role_id" uuid REFERENCES "roles"("id") ON DELETE SET NULL,
        ADD COLUMN "is_barber" boolean NOT NULL DEFAULT false`);

    await queryRunner.query(`
      UPDATE "users" u
         SET "is_barber" = true,
             "role_id" = (
               SELECT r.id FROM "roles" r
                WHERE r.tenant_id = u.tenant_id
                  AND r.system_key = CASE WHEN u.is_admin THEN 'admin' ELSE 'barber' END
             )`);

    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "is_admin"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN "is_admin" boolean NOT NULL DEFAULT false',
    );
    await queryRunner.query(`
      UPDATE "users" u SET "is_admin" = true
        FROM "roles" r WHERE r.id = u.role_id AND r.system_key = 'admin'`);
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "role_id", DROP COLUMN "is_barber"',
    );
    await queryRunner.query('DROP TABLE "roles"');
  }
}
