import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Lista de espera: clientes que queriam um horário num dia lotado. Quando
// alguém cancela, a barbearia é avisada e quem está esperando recebe e-mail
export default class CreateWaitlistEntries1790780000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'waitlist_entries',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'client_id', type: 'uuid' },
          { name: 'date', type: 'date' },
          // null = qualquer barbeiro / qualquer serviço
          { name: 'provider_id', type: 'uuid', isNullable: true },
          { name: 'service_id', type: 'uuid', isNullable: true },
          // 'any', 'morning', 'afternoon' ou 'evening'
          { name: 'period', type: 'varchar', default: "'any'" },
          { name: 'notes', type: 'varchar', isNullable: true },
          // Quem colocou na lista: 'provider' ou 'client'
          { name: 'created_by', type: 'varchar' },
          { name: 'created_by_user', type: 'uuid', isNullable: true },
          // 'waiting' ou 'removed'
          { name: 'status', type: 'varchar', default: "'waiting'" },
          {
            name: 'notified_at',
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
            name: 'WaitlistClient',
            columnNames: ['client_id'],
            referencedTableName: 'clients',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'WaitlistProvider',
            columnNames: ['provider_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          {
            name: 'WaitlistService',
            columnNames: ['service_id'],
            referencedTableName: 'services',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          {
            name: 'WaitlistCreatedBy',
            columnNames: ['created_by_user'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'waitlist_entries',
      new TableIndex({
        name: 'IDX_waitlist_date_status',
        columnNames: ['date', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('waitlist_entries');
  }
}
