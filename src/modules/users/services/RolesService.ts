import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import Role from '../infra/typeorm/entities/Role';
import IRolesRepository from '../repositories/IRolesRepository';
import IUsersRepository from '../repositories/IUsersRepository';
import { isPermission, Permission } from '../permissions';

export interface IRoleView {
  id: string;
  name: string;
  permissions: Permission[];
  is_admin: boolean;
  system_key: string | null;
  // Quantos usuários têm este perfil
  users: number;
}

interface IRoleData {
  name: string;
  permissions: string[];
}

// Perfis de acesso da equipe: o administrador cria, renomeia e escolhe as
// permissões de cada um. O perfil Administrador é fixo (pode tudo)
@injectable()
class RolesService {
  constructor(
    @inject('RolesRepository')
    private rolesRepository: IRolesRepository,

    @inject('UsersRepository')
    private usersRepository: IUsersRepository,
  ) {}

  public async list(): Promise<IRoleView[]> {
    const roles = await this.rolesRepository.findAll();

    const views = await Promise.all(roles.map(role => this.view(role)));

    // Administrador primeiro, depois por nome
    return views.sort(
      (a, b) =>
        Number(b.is_admin) - Number(a.is_admin) || a.name.localeCompare(b.name),
    );
  }

  public async create(data: IRoleData): Promise<IRoleView> {
    const { name, permissions } = await this.validate(data);

    const role = await this.rolesRepository.create({ name, permissions });

    return this.view(role);
  }

  public async update(id: string, data: IRoleData): Promise<IRoleView> {
    const role = await this.find(id);

    if (role.isAdmin) {
      throw new AppError('O perfil Administrador não pode ser alterado.');
    }

    const { name, permissions } = await this.validate(data, id);

    role.name = name;
    role.stored_permissions = permissions;

    await this.rolesRepository.save(role);

    return this.view(role);
  }

  public async remove(id: string): Promise<void> {
    const role = await this.find(id);

    if (role.isAdmin) {
      throw new AppError('O perfil Administrador não pode ser excluído.');
    }

    const users = await this.usersRepository.countByRole(id);

    if (users > 0) {
      throw new AppError(
        `${
          users === 1 ? '1 usuário usa' : `${users} usuários usam`
        } este perfil. Troque o perfil deles antes de excluir.`,
      );
    }

    await this.rolesRepository.remove(role);
  }

  private async find(id: string): Promise<Role> {
    const role = await this.rolesRepository.findById(id);

    if (!role) throw new AppError('Perfil não encontrado.', 404);

    return role;
  }

  private async validate(
    { name, permissions }: IRoleData,
    except?: string,
  ): Promise<{ name: string; permissions: Permission[] }> {
    const cleanName = name.trim();

    if (!cleanName) throw new AppError('Informe o nome do perfil.');

    const sameName = await this.rolesRepository.findByName(cleanName);

    if (sameName && sameName.id !== except) {
      throw new AppError('Já existe um perfil com esse nome.');
    }

    const invalid = permissions.find(permission => !isPermission(permission));

    if (invalid) throw new AppError(`Permissão desconhecida: ${invalid}.`);

    return {
      name: cleanName,
      permissions: Array.from(new Set(permissions)) as Permission[],
    };
  }

  private async view(role: Role): Promise<IRoleView> {
    return {
      id: role.id,
      name: role.name,
      permissions: role.allowed,
      is_admin: role.isAdmin,
      system_key: role.system_key,
      users: await this.usersRepository.countByRole(role.id),
    };
  }
}

export default RolesService;
