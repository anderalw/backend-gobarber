import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

// Cancelar não apaga o agendamento: guarda quando e por quem (barbeiro ou
// cliente). Agendamentos cancelados liberam o horário, então a restrição de
// sobreposição passa a valer só para os ativos
export default class AddCancellationToAppointments1790550477893
  implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('appointments', [
      new TableColumn({
        name: 'canceled_at',
        type: 'timestamp with time zone',
        isNullable: true,
      }),
      new TableColumn({
        name: 'canceled_by',
        type: 'varchar',
        isNullable: true,
      }),
    ]);

    await queryRunner.query(
      'ALTER TABLE appointments DROP CONSTRAINT "AppointmentsNoOverlap"',
    );
    await queryRunner.query(
      'ALTER TABLE appointments ADD CONSTRAINT "AppointmentsNoOverlap" EXCLUDE USING gist (provider_id WITH =, tstzrange(date, blocked_until) WITH &&) WHERE (canceled_at IS NULL)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE appointments DROP CONSTRAINT "AppointmentsNoOverlap"',
    );
    // Sem a coluna, cancelados voltariam a ocupar horário: são apagados
    await queryRunner.query(
      'DELETE FROM appointments WHERE canceled_at IS NOT NULL',
    );
    await queryRunner.dropColumn('appointments', 'canceled_by');
    await queryRunner.dropColumn('appointments', 'canceled_at');
    await queryRunner.query(
      'ALTER TABLE appointments ADD CONSTRAINT "AppointmentsNoOverlap" EXCLUDE USING gist (provider_id WITH =, tstzrange(date, blocked_until) WITH &&)',
    );
  }
}
