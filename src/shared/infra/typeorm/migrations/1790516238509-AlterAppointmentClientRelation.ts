import {
  MigrationInterface,
  QueryRunner,
  TableForeignKey,
} from 'typeorm';

export default class AlterAppointmentClientRelation1234567890123
  implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('appointments');
    const foreignKey = table?.foreignKeys.find(
      fk => fk.columnNames.indexOf('user_id') !== -1,
    );

    if (foreignKey) {
      await queryRunner.dropForeignKey('appointments', foreignKey);
    }

    // --- LINHA ADICIONADA PARA RESOLVER O ERRO ---
    // Limpa os IDs antigos para que o PostgreSQL não tente procurá-los na tabela vazia 'clients'
    await queryRunner.query('UPDATE appointments SET user_id = NULL');

    await queryRunner.renameColumn('appointments', 'user_id', 'client_id');

    await queryRunner.createForeignKey(
      'appointments',
      new TableForeignKey({
        name: 'AppointmentClient',
        columnNames: ['client_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'clients',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('appointments', 'AppointmentClient');
    await queryRunner.renameColumn('appointments', 'client_id', 'user_id');
    
    await queryRunner.createForeignKey(
      'appointments',
      new TableForeignKey({
        name: 'AppointmentUser',
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  }
}