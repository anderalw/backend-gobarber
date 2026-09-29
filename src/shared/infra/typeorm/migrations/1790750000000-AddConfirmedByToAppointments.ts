import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

// Confirmação registrada pela barbearia (ex: depois de ligar para o cliente).
// null com confirmed_at preenchido = o cliente confirmou pelo link
export default class AddConfirmedByToAppointments1790750000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'appointments',
      new TableColumn({
        name: 'confirmed_by',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'appointments',
      new TableForeignKey({
        name: 'AppointmentConfirmedBy',
        columnNames: ['confirmed_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('appointments', 'AppointmentConfirmedBy');
    await queryRunner.dropColumn('appointments', 'confirmed_by');
  }
}
