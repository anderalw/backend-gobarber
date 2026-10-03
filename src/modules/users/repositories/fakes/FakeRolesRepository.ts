import { randomUUID } from 'crypto';

import IRolesRepository, { ICreateRoleDTO } from '../IRolesRepository';
import Role from '../../infra/typeorm/entities/Role';

class FakeRolesRepository implements IRolesRepository {
  private roles: Role[] = [];

  public async findAll(): Promise<Role[]> {
    return [...this.roles].sort((a, b) => a.name.localeCompare(b.name));
  }

  public async findById(id: string): Promise<Role | undefined> {
    return this.roles.find(role => role.id === id);
  }

  public async findBySystemKey(key: string): Promise<Role | undefined> {
    return this.roles.find(role => role.system_key === key);
  }

  public async findByName(name: string): Promise<Role | undefined> {
    return this.roles.find(
      role => role.name.toLowerCase() === name.toLowerCase(),
    );
  }

  public async create({
    name,
    permissions,
    system_key = null,
  }: ICreateRoleDTO): Promise<Role> {
    const role = Object.assign(new Role(), {
      id: randomUUID(),
      name,
      stored_permissions: permissions,
      system_key,
      created_at: new Date(),
      updated_at: new Date(),
    });

    this.roles.push(role);

    return role;
  }

  public async save(role: Role): Promise<Role> {
    return role;
  }

  public async remove(role: Role): Promise<void> {
    this.roles = this.roles.filter(item => item.id !== role.id);
  }
}

export default FakeRolesRepository;
