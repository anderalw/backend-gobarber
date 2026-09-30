import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const timestamps = [
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
];

// Clube de assinatura: planos com serviços incluídos, as assinaturas dos
// clientes, as mensalidades pagas e, no agendamento, o uso do plano
export default class CreateMemberships1790830000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'membership_plans',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'name', type: 'varchar' },
          { name: 'description', type: 'varchar', isNullable: true },
          { name: 'price_cents', type: 'int' },
          // [{ service_id, quantity }]; quantity null = ilimitado
          { name: 'items', type: 'jsonb', default: "'[]'" },
          // Dias mínimos entre dois usos do mesmo serviço (null = livre)
          { name: 'min_interval_days', type: 'int', isNullable: true },
          // Dias da semana em que vale (0 = domingo); null = todos
          { name: 'weekdays', type: 'jsonb', isNullable: true },
          // Desconto nos serviços fora do plano
          { name: 'discount_percent', type: 'int', default: 0 },
          { name: 'active', type: 'boolean', default: true },
          ...timestamps,
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'memberships',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'client_id', type: 'uuid' },
          { name: 'plan_id', type: 'uuid' },
          // 'pending' (pedido pelo site), 'active' ou 'canceled'
          { name: 'status', type: 'varchar' },
          // Início dos ciclos mensais do saldo
          { name: 'cycle_anchor', type: 'date', isNullable: true },
          // Pago até (exclusivo): depois disso, mais a tolerância, atrasa
          { name: 'paid_until', type: 'date', isNullable: true },
          {
            name: 'requested_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'canceled_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          { name: 'created_by', type: 'uuid', isNullable: true },
          ...timestamps,
        ],
        foreignKeys: [
          {
            name: 'MembershipClient',
            columnNames: ['client_id'],
            referencedTableName: 'clients',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'MembershipPlan',
            columnNames: ['plan_id'],
            referencedTableName: 'membership_plans',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'memberships',
      new TableIndex({
        name: 'IDX_memberships_client',
        columnNames: ['client_id'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'membership_payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'membership_id', type: 'uuid' },
          { name: 'amount_cents', type: 'int' },
          { name: 'payment_method', type: 'varchar' },
          // Mês coberto: [period_start, period_end)
          { name: 'period_start', type: 'date' },
          { name: 'period_end', type: 'date' },
          { name: 'paid_at', type: 'timestamp with time zone' },
          { name: 'received_by', type: 'uuid', isNullable: true },
          ...timestamps,
        ],
        foreignKeys: [
          {
            name: 'MembershipPaymentMembership',
            columnNames: ['membership_id'],
            referencedTableName: 'memberships',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'membership_payments',
      new TableIndex({
        name: 'IDX_membership_payments_paid_at',
        columnNames: ['paid_at'],
      }),
    );

    // Agendamento incluso no plano (preço 0) e o preço normal do serviço
    await queryRunner.addColumns('appointments', [
      new TableColumn({
        name: 'membership_id',
        type: 'uuid',
        isNullable: true,
      }),
      new TableColumn({
        name: 'list_price_cents',
        type: 'int',
        isNullable: true,
      }),
    ]);

    await queryRunner.createForeignKey(
      'appointments',
      new TableForeignKey({
        name: 'AppointmentMembership',
        columnNames: ['membership_id'],
        referencedTableName: 'memberships',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'appointments',
      new TableIndex({
        name: 'IDX_appointments_membership',
        columnNames: ['membership_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('appointments', 'IDX_appointments_membership');
    await queryRunner.dropForeignKey('appointments', 'AppointmentMembership');
    await queryRunner.dropColumn('appointments', 'list_price_cents');
    await queryRunner.dropColumn('appointments', 'membership_id');
    await queryRunner.dropTable('membership_payments');
    await queryRunner.dropTable('memberships');
    await queryRunner.dropTable('membership_plans');
  }
}
