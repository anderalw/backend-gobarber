import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

// Agendamentos passam a ter serviço e duração variável:
// - service_id e price_cents guardam o serviço e o valor do momento da marcação
// - end_date é o fim do atendimento (início + duração do serviço)
// - blocked_until é o fim somado ao intervalo entre atendimentos
// A restrição de exclusão impede, no próprio banco, que dois agendamentos do
// mesmo barbeiro se sobreponham (inclusive com requisições simultâneas)
export default class AddServiceAndDurationToAppointments1790549082482
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('appointments', [
      new TableColumn({ name: 'service_id', type: 'uuid', isNullable: true }),
      new TableColumn({ name: 'price_cents', type: 'int', isNullable: true }),
      new TableColumn({
        name: 'end_date',
        type: 'timestamp with time zone',
        isNullable: true,
      }),
      new TableColumn({
        name: 'blocked_until',
        type: 'timestamp with time zone',
        isNullable: true,
      }),
    ]);

    await queryRunner.createForeignKey(
      'appointments',
      new TableForeignKey({
        name: 'AppointmentService',
        columnNames: ['service_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'services',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Agendamentos antigos, sem serviço, continuam com 1 hora
    await queryRunner.query(
      `UPDATE appointments SET end_date = date + interval '1 hour', blocked_until = date + interval '1 hour'`,
    );
    await queryRunner.query(
      'ALTER TABLE appointments ALTER COLUMN end_date SET NOT NULL, ALTER COLUMN blocked_until SET NOT NULL',
    );

    // O índice único só impedia horários de início iguais; a exclusão cobre
    // qualquer sobreposição
    await queryRunner.dropIndex(
      'appointments',
      'AppointmentsProviderDateUnique',
    );
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
    await queryRunner.query(
      'ALTER TABLE appointments ADD CONSTRAINT "AppointmentsNoOverlap" EXCLUDE USING gist (provider_id WITH =, tstzrange(date, blocked_until) WITH &&)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE appointments DROP CONSTRAINT "AppointmentsNoOverlap"',
    );
    await queryRunner.createIndex(
      'appointments',
      new TableIndex({
        name: 'AppointmentsProviderDateUnique',
        columnNames: ['provider_id', 'date'],
        isUnique: true,
      }),
    );
    await queryRunner.dropForeignKey('appointments', 'AppointmentService');
    for (const column of [
      'service_id',
      'price_cents',
      'end_date',
      'blocked_until',
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await queryRunner.dropColumn('appointments', column);
    }
  }
}
