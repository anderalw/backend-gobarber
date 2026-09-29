import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

// Login com Google: a conta Google ligada ao cliente
export default class AddGoogleIdToClients1790800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'clients',
      new TableColumn({
        name: 'google_id',
        type: 'varchar',
        isNullable: true,
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('clients', 'google_id');
  }
}
