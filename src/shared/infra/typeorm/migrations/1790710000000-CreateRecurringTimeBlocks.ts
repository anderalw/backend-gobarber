import { MigrationInterface, QueryRunner, Table } from 'typeorm';

// Bloqueios que se repetem nos dias da semana escolhidos (ex: almoço)
export default class CreateRecurringTimeBlocks1790710000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'recurring_time_blocks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'provider_id',
            type: 'uuid',
          },
          {
            name: 'days_of_week',
            type: 'int',
            isArray: true,
            comment: '0 = domingo ... 6 = sábado',
          },
          {
            name: 'start_time',
            type: 'varchar',
            comment: 'Exemplo: 12:00',
          },
          {
            name: 'end_time',
            type: 'varchar',
            comment: 'Exemplo: 13:30',
          },
          {
            name: 'starts_on',
            type: 'date',
          },
          {
            name: 'ends_on',
            type: 'date',
            isNullable: true,
            comment: 'null = sem data de fim',
          },
          {
            name: 'reason',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            name: 'RecurringTimeBlockProvider',
            columnNames: ['provider_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'RecurringTimeBlockCreatedBy',
            columnNames: ['created_by'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('recurring_time_blocks');
  }
}
