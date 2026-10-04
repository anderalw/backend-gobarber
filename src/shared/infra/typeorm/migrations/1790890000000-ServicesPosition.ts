import { MigrationInterface, QueryRunner } from 'typeorm';

// Ordem dos serviços (no site e na tela de agendar), escolhida pela
// barbearia. Os que já existem começam em ordem alfabética
export default class ServicesPosition1790890000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "services" ADD COLUMN "position" integer NOT NULL DEFAULT 0',
    );

    await queryRunner.query(`
      UPDATE "services" s SET "position" = o.position
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY name) AS position
        FROM "services"
      ) o
      WHERE o.id = s.id`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "services" DROP COLUMN "position"');
  }
}
