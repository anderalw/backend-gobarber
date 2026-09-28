import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export default class CreateProviderSchedules1790525447507
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'provider_schedules',
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
            name: 'day_of_week',
            type: 'int',
          },
          {
            name: 'start_time',
            type: 'varchar',
            comment: 'Exemplo: 09:00',
          },
          {
            name: 'end_time',
            type: 'varchar',
            comment: 'Exemplo: 18:00',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            name: 'ScheduleProvider',
            columnNames: ['provider_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('provider_schedules');
  }
}
