import { MigrationInterface, QueryRunner } from 'typeorm';

// As colunas created_at/updated_at eram 'timestamp' sem fuso: o Postgres
// grava now() em UTC, mas o driver pg lê o valor como horário local, e as
// datas chegavam à aplicação 3 horas adiantadas (UTC-3). Isso também fazia
// o link de recuperação de senha valer 5 horas em vez de 2.
// Os valores existentes foram gravados em UTC, e são convertidos como tal.
const COLUMNS: Array<[string, string]> = [
  ['appointments', 'created_at'],
  ['appointments', 'updated_at'],
  ['clients', 'created_at'],
  ['clients', 'updated_at'],
  ['provider_schedules', 'created_at'],
  ['provider_schedules', 'updated_at'],
  ['users', 'created_at'],
  ['users', 'updated_at'],
  ['user_tokens', 'created_at'],
  ['user_tokens', 'updated_at'],
];

export default class ConvertTimestampsToTimestamptz1790548379113
  implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of COLUMNS) {
      // eslint-disable-next-line no-await-in-loop
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE timestamp with time zone USING "${column}" AT TIME ZONE 'UTC'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of COLUMNS) {
      // eslint-disable-next-line no-await-in-loop
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE timestamp without time zone USING "${column}" AT TIME ZONE 'UTC'`,
      );
    }
  }
}
