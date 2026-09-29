import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Maquininhas cadastradas pela barbearia: o identificador do aparelho na
// operadora (número de série, por exemplo) e um nome para a equipe reconhecer
export default class CreateTerminalDevices1790820000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'terminal_devices',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          // Operadora ('simulator', 'mercadopago'...)
          { name: 'provider', type: 'varchar' },
          // Id do aparelho na operadora
          { name: 'external_id', type: 'varchar' },
          { name: 'name', type: 'varchar' },
          // Desativada: some da tela de cobrança, mas continua cadastrada
          { name: 'active', type: 'boolean', default: true },
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
      }),
    );

    await queryRunner.createIndex(
      'terminal_devices',
      new TableIndex({
        name: 'IDX_terminal_devices_provider_external',
        columnNames: ['provider', 'external_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('terminal_devices');
  }
}
