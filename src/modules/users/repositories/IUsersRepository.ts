import IFindAllProvidersDTO from '@modules/users/dtos/IFindAllProvidersDTO';
import User from '../infra/typeorm/entities/User';
import IcreateUserDTO from '../dtos/ICreateUserDTO';

export default interface IUsersRepository {
  findAllProviders(data: IFindAllProvidersDTO): Promise<User[]>;
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  create(data: IcreateUserDTO): Promise<User>;
  save(user: User): Promise<User>;
}
