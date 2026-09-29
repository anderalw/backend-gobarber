import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

// Observações da barbearia sobre o cliente (preferências, alergias...),
// mostradas na ficha e ao abrir o agendamento
export default class AddNotesToClients1790760000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'clients',
      new TableColumn({ name: 'notes', type: 'text', isNullable: true }),
    );

    // A ficha soma os atendimentos de cada cliente
    await queryRunner.query(
      'CREATE INDEX "IDX_appointments_client_id" ON "appointments" ("client_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_appointments_client_id"');
    await queryRunner.dropColumn('clients', 'notes');
  }
}
