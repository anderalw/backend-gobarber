import { MigrationInterface, QueryRunner } from 'typeorm';

// Mais dados no cadastro: CPF, nascimento e endereço do cliente; telefone,
// CPF, nascimento e endereço da equipe. Quais aparecem (e se são
// obrigatórios) a barbearia escolhe nas configurações
export default class ProfileFields1790880000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN "cpf" varchar(11),
        ADD COLUMN "birth_date" date,
        ADD COLUMN "address" jsonb`);

    // O mesmo CPF não vira dois clientes na mesma barbearia
    await queryRunner.query(
      'CREATE UNIQUE INDEX "ClientsCpf" ON "clients" ("tenant_id", "cpf") WHERE "cpf" IS NOT NULL',
    );

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "phone" varchar(30),
        ADD COLUMN "cpf" varchar(11),
        ADD COLUMN "birth_date" date,
        ADD COLUMN "address" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN "phone", DROP COLUMN "cpf", DROP COLUMN "birth_date", DROP COLUMN "address"',
    );
    await queryRunner.query('DROP INDEX "ClientsCpf"');
    await queryRunner.query(
      'ALTER TABLE "clients" DROP COLUMN "cpf", DROP COLUMN "birth_date", DROP COLUMN "address"',
    );
  }
}
