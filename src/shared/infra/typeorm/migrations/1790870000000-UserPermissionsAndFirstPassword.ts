import { MigrationInterface, QueryRunner } from 'typeorm';

// Permissões no próprio usuário (somam às do perfil, que fica opcional) e a
// troca de senha obrigatória no primeiro acesso
export default class UserPermissionsAndFirstPassword1790870000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "permissions" text[] NOT NULL DEFAULT '{}',
        ADD COLUMN "must_change_password" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "permissions", DROP COLUMN "must_change_password"',
    );
  }
}
