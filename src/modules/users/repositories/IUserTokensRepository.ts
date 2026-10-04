import UserToken from '../infra/typeorm/entities/UserToken';

export default interface IUserTokensRepository {
  generate(user_id: string): Promise<UserToken>;
  findByToken(token: string): Promise<UserToken | undefined>;
  // Depois de usar: nenhum link antigo do usuário vale mais
  deleteFromUser(user_id: string): Promise<void>;
}
