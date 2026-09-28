import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

// Barbeiro desativado: não entra no sistema, não aparece para os clientes nem
// na agenda (salvo nos dias em que já tem atendimentos) e não recebe novos
// agendamentos. Os horários de trabalho ficam guardados para reativar depois
export default class AddActiveToUsers1790640000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'active',
        type: 'boolean',
        isNullable: false,
        default: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'active');
  }
}
