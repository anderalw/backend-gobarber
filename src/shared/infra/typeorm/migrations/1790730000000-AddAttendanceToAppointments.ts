import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

// Situação do atendimento depois do horário: concluído ou falta do cliente.
// Sem registro (null), o atendimento que já passou fica "a confirmar"
export default class AddAttendanceToAppointments1790730000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('appointments', [
      new TableColumn({
        name: 'attendance',
        type: 'varchar',
        isNullable: true,
        comment: "'completed' ou 'no_show'",
      }),
      new TableColumn({
        name: 'attendance_at',
        type: 'timestamp with time zone',
        isNullable: true,
      }),
      new TableColumn({
        name: 'attendance_by',
        type: 'uuid',
        isNullable: true,
      }),
    ]);

    await queryRunner.createForeignKey(
      'appointments',
      new TableForeignKey({
        name: 'AppointmentAttendanceBy',
        columnNames: ['attendance_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('appointments', 'AppointmentAttendanceBy');
    await queryRunner.dropColumn('appointments', 'attendance_by');
    await queryRunner.dropColumn('appointments', 'attendance_at');
    await queryRunner.dropColumn('appointments', 'attendance');
  }
}
