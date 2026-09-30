import { injectable, inject } from 'tsyringe';

import IUsersRepository from '../repositories/IUsersRepository';
import IHashProvider from '../providers/HashProvider/models/IHashProvider';

interface IRequest {
  name?: string;
  email?: string;
  password?: string;
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
  ) {}

  // O e-mail do admin criado, ou null se não precisou (ou faltam dados)
  public async execute({
    name,
    email,
    password,
  }: IRequest): Promise<string | null> {
    if (!email || !password) return null;

    const existing = await this.usersRepository.findAllProviders({
      include_inactive: true,
    });

    if (existing.length > 0) return null;

    if (password.length < 8) {
      throw new Error('ADMIN_PASSWORD precisa de pelo menos 8 caracteres.');
    }

    const user = await this.usersRepository.create({
      name: name || 'Administrador',
      email: email.trim().toLowerCase(),
      password: await this.hashProvider.generateHash(password),
    });

    user.is_admin = true;
    await this.usersRepository.save(user);

    return user.email;
  }
}

export default EnsureFirstAdminService;
