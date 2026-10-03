import IFindAllProvidersDTO from '@modules/users/dtos/IFindAllProvidersDTO';
import User from '../infra/typeorm/entities/User';
import IcreateUserDTO from '../dtos/ICreateUserDTO';

export default interface IUsersRepository {
  // Só os barbeiros
  findAllProviders(data: IFindAllProvidersDTO): Promise<User[]>;
  // Toda a equipe (barbeiros ou não, ativos ou não)
  findAllStaff(): Promise<User[]>;
  countByRole(role_id: string): Promise<number>;
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  create(data: IcreateUserDTO): Promise<User>;
  save(user: User): Promise<User>;
}
