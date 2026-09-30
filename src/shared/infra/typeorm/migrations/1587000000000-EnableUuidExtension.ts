import { MigrationInterface, QueryRunner } from 'typeorm';

// As tabelas geram os ids com uuid_generate_v4(), que vem da extensão
// uuid-ossp. Em bancos antigos ela foi ligada à mão; num banco novo (ex.:
// o Docker de um cliente do SaaS) esta migration liga antes das outras
export default class EnableUuidExtension1587000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  }

  public async down(): Promise<void> {
    // Outras tabelas dependem dela: fica ligada
  }
}
