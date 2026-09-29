import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

// Caixa: forma de pagamento e valor recebido em cada atendimento, e o
// fechamento de cada dia (fundo de troco, dinheiro contado, diferença)
export default class CreateCashRegister1790790000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('appointments', [
      // 'pix', 'credit', 'debit' ou 'cash'; null = não informado
      new TableColumn({
        name: 'payment_method',
        type: 'varchar',
        isNullable: true,
      }),
      // Valor recebido (com desconto ou acréscimo); null = o preço marcado
      new TableColumn({ name: 'paid_cents', type: 'int', isNullable: true }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'cash_closings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'date', type: 'date', isUnique: true },
          { name: 'opening_cents', type: 'int' },
          { name: 'counted_cents', type: 'int' },
          { name: 'expected_cash_cents', type: 'int' },
          { name: 'received_cents', type: 'int' },
          // Totais por forma de pagamento no momento do fechamento
          { name: 'totals', type: 'jsonb' },
          { name: 'notes', type: 'varchar', isNullable: true },
          { name: 'closed_by', type: 'uuid', isNullable: true },
          { name: 'closed_at', type: 'timestamp with time zone' },
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
        foreignKeys: [
          {
            name: 'CashClosingClosedBy',
            columnNames: ['closed_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('cash_closings');
    await queryRunner.dropColumn('appointments', 'paid_cents');
    await queryRunner.dropColumn('appointments', 'payment_method');
  }
}
