import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';
import { IAddress } from '@shared/utils/documents';
import { IProfileValues } from '@modules/catalog/services/ProfileFieldsService';
import User from '../infra/typeorm/entities/User';
import Role from '../infra/typeorm/entities/Role';
import IUsersRepository from '../repositories/IUsersRepository';
import IRolesRepository from '../repositories/IRolesRepository';
import IHashProvider from '../providers/HashProvider/models/IHashProvider';
import { isPermission, Permission } from '../permissions';

export interface IStaffView {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  active: boolean;
  is_barber: boolean;
  // Ainda com a senha provisória (o e-mail)
  must_change_password: boolean;
  role: { id: string; name: string; is_admin: boolean } | null;
  // Dadas só a este usuário
  own_permissions: Permission[];
  // Tudo o que ele pode (perfil + próprias)
  permissions: Permission[];
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  address: IAddress | null;
}

interface ICreate {
  name: string;
  email: string;
  role_id?: string | null;
  permissions?: string[];
}

interface IUpdate {
  name: string;
  email: string;
  role_id: string | null;
  permissions: string[];
}

// Usuários da equipe (quem entra no sistema) e o que cada um pode fazer:
// um perfil opcional mais as permissões dele. A senha provisória é o
// próprio e-mail, trocada no primeiro acesso. Ser barbeiro é à parte
// (BarbersService)
@injectable()
class StaffUsersService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('RolesRepository')
    private rolesRepository: IRolesRepository,

    @inject('HashProvider')
    private hashProvider: IHashProvider,

    @inject('CacheProvider')
    private cacheProvider: ICacheProvider,
  ) {}

  public static view(user: User): IStaffView {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.getAvatarUrl(),
      active: user.active,
      is_barber: user.is_barber,
      must_change_password: !!user.must_change_password,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
            is_admin: user.role.isAdmin,
          }
        : null,
      own_permissions: user.own_permissions || [],
      permissions: user.allowed,
      phone: user.phone ?? null,
      cpf: user.cpf ?? null,
      birth_date: user.birth_date ?? null,
      address: user.address ?? null,
    };
  }

  public async list(): Promise<IStaffView[]> {
    const users = await this.usersRepository.findAllStaff();

    // Ativos primeiro, depois por nome
    return users
      .map(user => StaffUsersService.view(user))
      .sort(
        (a, b) =>
          Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
      );
  }

  public async show(id: string): Promise<IStaffView> {
    return StaffUsersService.view(await this.findUser(id));
  }

  public async create({
    name,
    email,
    role_id = null,
    permissions = [],
  }: ICreate): Promise<IStaffView> {
    const cleanName = this.cleanName(name);
    const cleanEmail = await this.availableEmail(email);
    const role = await this.findRole(role_id);

    const user = await this.usersRepository.create({
      name: cleanName,
      email: cleanEmail,
      // Senha provisória: o próprio e-mail
      password: await this.hashProvider.generateHash(cleanEmail),
      must_change_password: true,
      role_id: role?.id ?? null,
      own_permissions: this.validPermissions(permissions),
      is_barber: false,
    });

    user.role = role;

    return StaffUsersService.view(user);
  }

  public async update(
    requester_id: string,
    id: string,
    { name, email, role_id, permissions }: IUpdate,
    // Telefone, CPF, nascimento e endereço já conferidos pelas regras da
    // barbearia (ProfileFieldsService); só muda o que veio
    extras: IProfileValues = {},
  ): Promise<IStaffView> {
    const user = await this.findUser(id);
    const role = await this.findRole(role_id);
    const own = this.validPermissions(permissions);

    const accessChanged =
      (role?.id ?? null) !== (user.role_id ?? null) ||
      own.slice().sort().join() !==
        (user.own_permissions || []).slice().sort().join();

    if (accessChanged) {
      // Quem mexe no próprio acesso pode perder o acesso a esta tela
      if (id === requester_id) {
        throw new AppError(
          'Você não pode mudar o seu próprio perfil ou permissões.',
        );
      }

      if (user.role?.isAdmin && !role?.isAdmin) {
        await this.ensureAnotherAdmin(user);
      }
    }

    user.name = this.cleanName(name);
    user.email = await this.availableEmail(email, id);
    user.role_id = role?.id ?? null;
    user.role = role;
    user.own_permissions = own;

    (['phone', 'cpf', 'birth_date', 'address'] as const).forEach(field => {
      if (extras[field] !== undefined) {
        Object.assign(user, { [field]: extras[field] });
      }
    });

    await this.usersRepository.save(user);

    // O nome aparece na lista de barbeiros, que fica em cache
    await this.cacheProvider.invalidatePrefix('providers-list');

    return StaffUsersService.view(user);
  }

  // Volta para a senha provisória (o e-mail), com troca no próximo acesso
  public async resetPassword(
    requester_id: string,
    id: string,
  ): Promise<IStaffView> {
    if (id === requester_id) {
      throw new AppError('Para trocar a sua senha, use Meu perfil.');
    }

    const user = await this.findUser(id);

    user.password = await this.hashProvider.generateHash(user.email);
    user.must_change_password = true;

    await this.usersRepository.save(user);

    return StaffUsersService.view(user);
  }

  // Não deixa a barbearia sem nenhum administrador ativo
  public async ensureAnotherAdmin(user: User): Promise<void> {
    const staff = await this.usersRepository.findAllStaff();
    const others = staff.filter(
      item => item.id !== user.id && item.active && item.role?.isAdmin,
    );

    if (others.length === 0) {
      throw new AppError('É preciso ter pelo menos um administrador ativo.');
    }
  }

  private validPermissions(permissions: string[]): Permission[] {
    const invalid = permissions.find(permission => !isPermission(permission));

    if (invalid) throw new AppError(`Permissão desconhecida: ${invalid}.`);

    return Array.from(new Set(permissions)) as Permission[];
  }

  private cleanName(name: string): string {
    const clean = name.trim();

    if (!clean) throw new AppError('Informe o nome.');

    return clean;
  }

  private async availableEmail(
    email: string,
    except?: string,
  ): Promise<string> {
    const clean = email.trim().toLowerCase();
    const owner = await this.usersRepository.findByEmail(clean);

    if (owner && owner.id !== except) {
      throw new AppError('Este e-mail já está em uso por outro usuário.');
    }

    return clean;
  }

  private async findUser(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);

    if (!user) throw new AppError('Usuário não encontrado.', 404);

    return user;
  }

  // Sem perfil é permitido (null)
  private async findRole(id: string | null): Promise<Role | null> {
    if (!id) return null;

    const role = await this.rolesRepository.findById(id);

    if (!role) throw new AppError('Escolha um perfil válido.');

    return role;
  }
}

export default StaffUsersService;
