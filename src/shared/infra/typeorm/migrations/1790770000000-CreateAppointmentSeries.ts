import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

// Cliente fixo: vários agendamentos marcados de uma vez, a cada N semanas.
// Cada horário continua sendo um agendamento comum, ligado à série
export default class CreateAppointmentSeries1790770000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'appointment_series',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'client_id', type: 'uuid', isNullable: true },
          { name: 'provider_id', type: 'uuid', isNullable: true },
          { name: 'service_id', type: 'uuid', isNullable: true },
          { name: 'interval_weeks', type: 'int' },
          { name: 'created_by', type: 'uuid', isNullable: true },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            name: 'AppointmentSeriesClient',
            columnNames: ['client_id'],
            referencedTableName: 'clients',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          {
            name: 'AppointmentSeriesProvider',
            columnNames: ['provider_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          {
            name: 'AppointmentSeriesService',
            columnNames: ['service_id'],
            referencedTableName: 'services',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          {
            name: 'AppointmentSeriesCreatedBy',
            columnNames: ['created_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.addColumn(
      'appointments',
      new TableColumn({ name: 'series_id', type: 'uuid', isNullable: true }),
    );

    await queryRunner.createForeignKey(
      'appointments',
      new TableForeignKey({
        name: 'AppointmentSeries',
        columnNames: ['series_id'],
        referencedTableName: 'appointment_series',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.query(
      'CREATE INDEX "IDX_appointments_series_id" ON "appointments" ("series_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_appointments_series_id"');
    await queryRunner.dropForeignKey('appointments', 'AppointmentSeries');
    await queryRunner.dropColumn('appointments', 'series_id');
    await queryRunner.dropTable('appointment_series');
  }
}
