import { MigrationInterface, QueryRunner } from 'typeorm';

// O barbeiro pode cadastrar um cliente na hora de marcar pela agenda, só com
// nome, telefone e (opcionalmente) e-mail. Esse cliente ainda não tem senha;
// ao criar a conta no site com o mesmo e-mail, o cadastro é completado
export default class AllowClientsRegisteredByProvider1790580000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE clients ALTER COLUMN email DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE clients ALTER COLUMN password DROP NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Falha se já houver clientes sem e-mail ou senha: eles precisariam ser
    // completados ou removidos antes de desfazer
    await queryRunner.query(
      'ALTER TABLE clients ALTER COLUMN password SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE clients ALTER COLUMN email SET NOT NULL',
    );
  }
}
