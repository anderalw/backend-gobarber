import { MigrationInterface, QueryRunner } from 'typeorm';

import { enableTenancy } from '../tenancySql';

// Links de recuperação de senha dos clientes (como os da equipe)
export default class ClientTokens1790900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "client_tokens" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "token" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);

    await enableTenancy(queryRunner, 'client_tokens');

    await queryRunner.query(
      'CREATE INDEX "ClientTokensToken" ON "client_tokens" ("token")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "client_tokens"');
  }
}
