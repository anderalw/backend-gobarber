import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

// Impede dois agendamentos no mesmo horário para o mesmo barbeiro,
// mesmo quando duas requisições chegam ao mesmo tempo
export default class AddUniqueProviderDateToAppointments1790545687373
  implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'appointments',
      new TableIndex({
        name: 'AppointmentsProviderDateUnique',
        columnNames: ['provider_id', 'date'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'appointments',
      'AppointmentsProviderDateUnique',
    );
  }
}
