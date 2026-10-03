import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';
import User from '../infra/typeorm/entities/User';
import Role from '../infra/typeorm/entities/Role';
import IUsersRepository from '../repositories/IUsersRepository';
import IRolesRepository from '../repositories/IRolesRepository';
import IHashProvider from '../providers/HashProvider/models/IHashProvider';

export interface IStaffView {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  active: boolean;
  is_barber: boolean;
  role: { id: string; name: string; is_admin: boolean } | null;
}

interface ICreate {
  name: string;
  email: string;
  password: string;
  role_id: string;
}

interface IUpdate {
  name: string;
  email: string;
  role_id: string;
  // Vazio: mantém a senha
  password?: string;
}

const MIN_PASSWORD = 6;

// Usuários da equipe (quem entra no sistema), com o perfil de acesso. Ser
// barbeiro é à parte (BarbersService)
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
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
            is_admin: user.role.isAdmin,
          }
        : null,
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

  public async create({
    name,
    email,
    password,
    role_id,
  }: ICreate): Promise<IStaffView> {
    const cleanName = this.cleanName(name);
    const cleanEmail = await this.availableEmail(email);
    const role = await this.findRole(role_id);

    if (password.length < MIN_PASSWORD) {
      throw new AppError(
        `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.`,
      );
    }

    const user = await this.usersRepository.create({
      name: cleanName,
      email: cleanEmail,
      password: await this.hashProvider.generateHash(password),
      role_id: role.id,
      is_barber: false,
    });

    user.role = role;

    return StaffUsersService.view(user);
  }

  public async update(
    requester_id: string,
    id: string,
    { name, email, role_id, password }: IUpdate,
  ): Promise<IStaffView> {
    const user = await this.findUser(id);
    const role = await this.findRole(role_id);

    if (role.id !== user.role_id) {
      // Quem troca o próprio perfil pode perder o acesso a esta tela
      if (id === requester_id) {
        throw new AppError('Você não pode trocar o seu próprio perfil.');
      }

      if (user.role?.isAdmin && !role.isAdmin) {
        await this.ensureAnotherAdmin(user);
      }
    }

    user.name = this.cleanName(name);
    user.email = await this.availableEmail(email, id);
    user.role_id = role.id;
    user.role = role;

    if (password) {
      if (password.length < MIN_PASSWORD) {
        throw new AppError(
          `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.`,
        );
      }

      user.password = await this.hashProvider.generateHash(password);
    }

    await this.usersRepository.save(user);

    // O nome aparece na lista de barbeiros, que fica em cache
    await this.cacheProvider.invalidatePrefix('providers-list');

    return StaffUsersService.view(user);
  }

  // Não deixa a barbearia sem nenhum administrador ativo
  public async ensureAnotherAdmin(user: User): Promise<void> {
    const staff = await this.usersRepository.findAllStaff();
    const others = staff.filter(
      item => item.id !== user.id && item.active && item.role?.isAdmin,
    );

    if (others.length === 0) {
      throw new AppError(
        'A barbearia precisa de pelo menos um administrador ativo.',
      );
    }
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

  private async findRole(id: string): Promise<Role> {
    const role = await this.rolesRepository.findById(id);

    if (!role) throw new AppError('Escolha um perfil válido.');

    return role;
  }
}

export default StaffUsersService;
