import { MigrationInterface, QueryRunner } from 'typeorm';

import { enableTenancy } from '../tenancySql';

// Recursos próprios de cada ramo: sinal para garantir o horário (valor em
// cada serviço), pacotes de sessões vendidos ao cliente e o aceite do termo
// de consentimento
export default class SegmentResources1790920000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "services" ADD COLUMN "deposit_cents" int',
    );

    await queryRunner.query(`
      CREATE TABLE "session_packages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "service_id" uuid NOT NULL REFERENCES "services"("id"),
        "sessions" int NOT NULL,
        "price_cents" int NOT NULL,
        "payment_method" varchar NOT NULL,
        "paid_at" timestamptz NOT NULL,
        "received_by" uuid,
        "canceled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);

    await enableTenancy(queryRunner, 'session_packages');

    await queryRunner.query(
      'CREATE INDEX "SessionPackagesClient" ON "session_packages" ("client_id")',
    );

    await queryRunner.query(`
      ALTER TABLE "appointments"
        ADD COLUMN "deposit_cents" int,
        ADD COLUMN "deposit_paid_at" timestamptz,
        ADD COLUMN "deposit_method" varchar,
        ADD COLUMN "deposit_received_by" uuid,
        ADD COLUMN "package_id" uuid REFERENCES "session_packages"("id") ON DELETE SET NULL`);

    await queryRunner.query(
      'CREATE INDEX "AppointmentsPackage" ON "appointments" ("package_id") WHERE "package_id" IS NOT NULL',
    );

    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN "consent_version" varchar,
        ADD COLUMN "consent_accepted_at" timestamptz,
        ADD COLUMN "consent_by" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "clients" DROP COLUMN "consent_version", DROP COLUMN "consent_accepted_at", DROP COLUMN "consent_by"',
    );
    await queryRunner.query(
      'ALTER TABLE "appointments" DROP COLUMN "deposit_cents", DROP COLUMN "deposit_paid_at", DROP COLUMN "deposit_method", DROP COLUMN "deposit_received_by", DROP COLUMN "package_id"',
    );
    await queryRunner.query('DROP TABLE "session_packages"');
    await queryRunner.query(
      'ALTER TABLE "services" DROP COLUMN "deposit_cents"',
    );
  }
}
