import { Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';

import IRolesRepository, {
  ICreateRoleDTO,
} from '@modules/users/repositories/IRolesRepository';
import Role from '../entities/Role';

class RolesRepository implements IRolesRepository {
  private ormRepository: Repository<Role>;

  constructor() {
    this.ormRepository = dataSource.getRepository(Role);
  }

  public async findAll(): Promise<Role[]> {
    return this.ormRepository.find({ order: { name: 'ASC' } });
  }

  public async findById(id: string): Promise<Role | undefined> {
    if (!id) return undefined;

    return (await this.ormRepository.findOneBy({ id })) ?? undefined;
  }

  public async findBySystemKey(key: string): Promise<Role | undefined> {
    return (
      (await this.ormRepository.findOneBy({ system_key: key })) ?? undefined
    );
  }

  public async findByName(name: string): Promise<Role | undefined> {
    return (
      (await this.ormRepository
        .createQueryBuilder('role')
        .where('lower(role.name) = lower(:name)', { name })
        .getOne()) ?? undefined
    );
  }

  public async create({
    name,
    permissions,
    system_key = null,
  }: ICreateRoleDTO): Promise<Role> {
    const role = this.ormRepository.create({
      name,
      stored_permissions: permissions,
      system_key,
    });

    return this.ormRepository.save(role);
  }

  public async save(role: Role): Promise<Role> {
    return this.ormRepository.save(role);
  }

  public async remove(role: Role): Promise<void> {
    await this.ormRepository.remove(role);
  }
}

export default RolesRepository;
