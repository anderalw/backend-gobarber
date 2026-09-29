import { MigrationInterface, QueryRunner, Table } from 'typeorm';

// Motivos cadastrados para os bloqueios de horário, já com os mais comuns
export default class CreateBlockReasons1790720000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'block_reasons',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
      }),
    );

    // Sem nomes repetidos, ignorando maiúsculas
    await queryRunner.query(
      'CREATE UNIQUE INDEX "BlockReasonsName" ON "block_reasons" (lower("name"))',
    );

    await queryRunner.query(
      `INSERT INTO "block_reasons" ("name") VALUES ('Almoço'), ('Consulta'), ('Folga'), ('Férias')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('block_reasons');
  }
}
