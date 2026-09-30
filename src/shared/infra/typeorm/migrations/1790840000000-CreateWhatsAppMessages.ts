import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Mensagens de WhatsApp para os clientes: a fila do envio assistido e o
// histórico do que foi enviado (ou pulado)
export default class CreateWhatsAppMessages1790840000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          // 'reminder', 'appointment_created', 'membership_due'...
          { name: 'kind', type: 'varchar' },
          { name: 'client_id', type: 'uuid', isNullable: true },
          { name: 'client_name', type: 'varchar' },
          // Com código do país (5511999990000); null = telefone inválido
          { name: 'phone', type: 'varchar', isNullable: true },
          { name: 'body', type: 'text' },
          // 'pending', 'sent', 'failed', 'skipped' ou 'expired'
          { name: 'status', type: 'varchar' },
          // Modo de envio ('manual', 'simulator', 'meta'...)
          { name: 'provider', type: 'varchar' },
          // Evita mandar a mesma mensagem duas vezes
          { name: 'dedupe_key', type: 'varchar', isNullable: true },
          // Depois disso a mensagem perde o sentido (ex.: o horário passou)
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          { name: 'attempts', type: 'int', default: 0 },
          { name: 'error', type: 'varchar', isNullable: true },
          { name: 'external_id', type: 'varchar', isNullable: true },
          {
            name: 'sent_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          // Quem enviou (assistido) ou pulou
          { name: 'handled_by', type: 'uuid', isNullable: true },
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
            name: 'WhatsAppMessageClient',
            columnNames: ['client_id'],
            referencedTableName: 'clients',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createIndices('whatsapp_messages', [
      new TableIndex({
        name: 'IDX_whatsapp_messages_dedupe',
        columnNames: ['dedupe_key'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_whatsapp_messages_status',
        columnNames: ['status'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('whatsapp_messages');
  }
}
