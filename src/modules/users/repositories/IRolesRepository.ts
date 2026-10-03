import Role from '../infra/typeorm/entities/Role';
import { Permission } from '../permissions';

export interface ICreateRoleDTO {
  name: string;
  permissions: Permission[];
  system_key?: string | null;
}

export default interface IRolesRepository {
  // Em ordem alfabética
  findAll(): Promise<Role[]>;
  findById(id: string): Promise<Role | undefined>;
  findBySystemKey(key: string): Promise<Role | undefined>;
  findByName(name: string): Promise<Role | undefined>;
  create(data: ICreateRoleDTO): Promise<Role>;
  save(role: Role): Promise<Role>;
  remove(role: Role): Promise<void>;
}
