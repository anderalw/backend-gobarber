import { injectable, inject } from 'tsyringe';

import IUsersRepository from '../repositories/IUsersRepository';
import IHashProvider from '../providers/HashProvider/models/IHashProvider';
import IRolesRepository from '../repositories/IRolesRepository';
import { ADMIN_ROLE, DEFAULT_ROLES } from '../permissions';

interface IRequest {
  name?: string;
  email?: string;
  password?: string;
  // Senha já cifrada (bcrypt): usada como está
  password_hash?: string;
}

// Ambiente novo (ex.: um cliente recém-contratado no SaaS): sem nenhum
// barbeiro cadastrado não há quem entre para cadastrar o resto. Com
// ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD definidos, cria esse primeiro
// administrador ao subir o servidor. Com alguém já cadastrado, não faz nada
@injectable()
class EnsureFirstAdminService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('HashProvider')
    private hashProvider: IHashProvider,

    @inject('RolesRepository')
    private rolesRepository: IRolesRepository,
  ) {}

  // O e-mail do admin criado, ou null se não precisou (ou faltam dados)
  public async execute({
    name,
    email,
    password,
    password_hash,
  }: IRequest): Promise<string | null> {
    if (!email || (!password && !password_hash)) return null;

    const existing = await this.usersRepository.findAllStaff();

    if (existing.length > 0) return null;

    if (!password_hash && (password || '').length < 8) {
      throw new Error('ADMIN_PASSWORD precisa de pelo menos 8 caracteres.');
    }

    const user = await this.usersRepository.create({
      name: name || 'Administrador',
      email: email.trim().toLowerCase(),
      password:
        password_hash ||
        (await this.hashProvider.generateHash(password as string)),
    });

    // Perfil Administrador (criado aqui se a barbearia ainda não tiver) e,
    // como o dono costuma atender, já entra como barbeiro
    const role =
      (await this.rolesRepository.findBySystemKey(ADMIN_ROLE)) ||
      (await this.rolesRepository.create(
        DEFAULT_ROLES.find(item => item.system_key === ADMIN_ROLE)!,
      ));

    user.role_id = role.id;
    user.role = role;
    user.is_barber = true;
    await this.usersRepository.save(user);

    return user.email;
  }
}

export default EnsureFirstAdminService;
