import { Repository, Not } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';

import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import ICreateUserDTO from '@modules/users/dtos/ICreateUserDTO';
import IFindAllProvidersDTO from '@modules/users/dtos/IFindAllProvidersDTO';

import User from '../entities/User';

class UsersRepository implements IUsersRepository {
  private ormRepository: Repository<User>;

  constructor() {
    this.ormRepository = dataSource.getRepository(User);
  }

  public async findById(id: string): Promise<User | undefined> {
    if (!id) return undefined;

    const user = await this.ormRepository.findOneBy({ id });

    return user ?? undefined;
  }

  public async findByEmail(email: string): Promise<User | undefined> {
    const user = await this.ormRepository.findOneBy({ email });

    return user ?? undefined;
  }

  public async findAllProviders({
    except_user_id,
    include_inactive = false,
  }: IFindAllProvidersDTO): Promise<User[]> {
    return this.ormRepository.find({
      where: {
        is_barber: true,
        ...(except_user_id && { id: Not(except_user_id) }),
        ...(!include_inactive && { active: true }),
      },
    });
  }

  public async findAllStaff(): Promise<User[]> {
    return this.ormRepository.find({ order: { name: 'ASC' } });
  }

  public async countByRole(role_id: string): Promise<number> {
    return this.ormRepository.countBy({ role_id });
  }

  public async create(userData: ICreateUserDTO): Promise<User> {
    const appointment = this.ormRepository.create(userData);

    await this.ormRepository.save(appointment);

    return appointment;
  }

  public async save(user: User): Promise<User> {
    return this.ormRepository.save(user);
  }
}
export default UsersRepository;
