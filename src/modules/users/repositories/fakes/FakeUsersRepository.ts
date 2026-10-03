import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import ICreateUserDTO from '@modules/users/dtos/ICreateUserDTO';
import IFindAllProvidersDTO from '@modules/users/dtos/IFindAllProvidersDTO';

import { randomUUID } from 'crypto';
import User from '../../infra/typeorm/entities/User';

class FakeUsersRepository implements IUsersRepository {
  private users: User[] = [];

  public async findById(id: string): Promise<User | undefined> {
    const findUser = this.users.find(user => user.id === id);

    return findUser;
  }

  public async findByEmail(email: string): Promise<User | undefined> {
    const findUser = this.users.find(user => user.email === email);

    return findUser;
  }

  public async findAllProviders({
    except_user_id,
    include_inactive = false,
  }: IFindAllProvidersDTO): Promise<User[]> {
    return this.users.filter(
      user =>
        user.is_barber &&
        user.id !== except_user_id &&
        (include_inactive || user.active),
    );
  }

  public async findAllStaff(): Promise<User[]> {
    return [...this.users];
  }

  public async countByRole(role_id: string): Promise<number> {
    return this.users.filter(user => user.role_id === role_id).length;
  }

  public async create(userData: ICreateUserDTO): Promise<User> {
    const user = new User();

    // Nos testes, quem é criado atende (como antes da separação), salvo
    // quando o teste diz o contrário
    Object.assign(
      user,
      { id: randomUUID(), active: true, is_barber: true, role_id: null },
      userData,
    );

    this.users.push(user);

    return user;
  }

  public async save(user: User): Promise<User> {
    const findIndex = this.users.findIndex(findUser => findUser.id === user.id);

    this.users[findIndex] = user;

    return user;
  }
}
export default FakeUsersRepository;
