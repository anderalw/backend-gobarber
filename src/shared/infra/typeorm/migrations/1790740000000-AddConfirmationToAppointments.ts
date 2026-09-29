import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

// Confirmação de presença pelo cliente: na véspera o sistema envia um link
// (confirmation_token); ao abrir, o agendamento fica confirmado
export default class AddConfirmationToAppointments1790740000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('appointments', [
      new TableColumn({
        name: 'confirmation_token',
        type: 'varchar',
        isNullable: true,
        isUnique: true,
      }),
      new TableColumn({
        name: 'confirmation_requested_at',
        type: 'timestamp with time zone',
        isNullable: true,
      }),
      new TableColumn({
        name: 'confirmed_at',
        type: 'timestamp with time zone',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('appointments', 'confirmed_at');
    await queryRunner.dropColumn('appointments', 'confirmation_requested_at');
    await queryRunner.dropColumn('appointments', 'confirmation_token');
  }
}
