import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Cobranças enviadas para a maquininha de cartão: cada tentativa de cobrar
// um atendimento, com a situação que a operadora devolve
export default class CreateCardCharges1790810000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'card_charges',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'appointment_id', type: 'uuid' },
          // Operadora ('simulator', 'mercadopago'...) e a maquininha usada
          { name: 'provider', type: 'varchar' },
          { name: 'device_id', type: 'varchar' },
          { name: 'device_name', type: 'varchar' },
          // Id da cobrança na operadora
          { name: 'external_id', type: 'varchar', isNullable: true },
          { name: 'amount_cents', type: 'int' },
          // 'pending', 'approved', 'rejected', 'canceled' ou 'expired'
          { name: 'status', type: 'varchar', default: "'pending'" },
          // Como foi pago ('credit', 'debit', 'pix'), quando aprovado
          { name: 'method', type: 'varchar', isNullable: true },
          { name: 'message', type: 'varchar', isNullable: true },
          { name: 'created_by', type: 'uuid', isNullable: true },
          {
            name: 'resolved_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
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
            name: 'CardChargeAppointment',
            columnNames: ['appointment_id'],
            referencedTableName: 'appointments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'CardChargeCreatedBy',
            columnNames: ['created_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'card_charges',
      new TableIndex({
        name: 'IDX_card_charges_status',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('card_charges');
  }
}
