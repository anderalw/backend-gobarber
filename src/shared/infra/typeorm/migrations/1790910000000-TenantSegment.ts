import { MigrationInterface, QueryRunner } from 'typeorm';

// Ramo de negócio de cada tenant (barbearia, estúdio, clínica...). Os que
// já existem são barbearias
export default class TenantSegment1790910000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN "segment" varchar NOT NULL DEFAULT 'barbershop'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "tenants" DROP COLUMN "segment"');
  }
}
