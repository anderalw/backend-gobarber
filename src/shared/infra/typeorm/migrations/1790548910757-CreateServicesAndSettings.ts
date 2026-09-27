import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export default class CreateServicesAndSettings1790548910757
  implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'services',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'name', type: 'varchar' },
          { name: 'duration_minutes', type: 'int' },
          { name: 'price_cents', type: 'int' },
          { name: 'active', type: 'boolean', default: true },
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

    await queryRunner.createTable(
      new Table({
        name: 'settings',
        columns: [
          { name: 'key', type: 'varchar', isPrimary: true },
          { name: 'value', type: 'varchar' },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('settings');
    await queryRunner.dropTable('services');
  }
}
