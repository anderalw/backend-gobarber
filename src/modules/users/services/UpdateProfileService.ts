import { injectable, inject } from 'tsyringe';

// import AppError from '@shared/errors/AppError';
import AppError from '@shared/errors/AppError';
import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';
import IHashProvider from '../providers/HashProvider/models/IHashProvider';
import IUsersRepository from '../repositories/IUsersRepository';
import User from '../infra/typeorm/entities/User';

interface IRequest {
  user_id: string;
  name: string;
  email: string;
  old_password?: string;
  password?: string;
}
@injectable()
class UpdateProfileService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('HashProvider')
    private hashProvider: IHashProvider,

    @inject('CacheProvider')
    private cacheProvider: ICacheProvider,
  ) {}

  public async execute({
    user_id,
    name,
    email,
    password,
    old_password,
  }: IRequest): Promise<User> {
    const user = await this.usersRepository.findById(user_id);

    if (!user) {
      throw new AppError('Usuário não encontrado.');
    }

    const userWithUpdateEmail = await this.usersRepository.findByEmail(email);
    if (userWithUpdateEmail && userWithUpdateEmail.id !== user_id) {
      throw new AppError('Este e-mail já está em uso.');
    }

    user.name = name;
    user.email = email;

    if (password && !old_password) {
      throw new AppError('Informe a senha antiga para definir uma nova senha.');
    }

    if (password && old_password) {
      const checkOldPassword = await this.hashProvider.compareHash(
        old_password,
        user.password,
      );
      if (!checkOldPassword) {
        throw new AppError('A senha antiga não confere.');
      }

      user.password = await this.hashProvider.generateHash(password);
    }

    const saved = await this.usersRepository.save(user);

    // Nome e foto aparecem na lista de barbeiros, que fica em cache
    await this.cacheProvider.invalidatePrefix('providers-list');

    return saved;
  }
}

export default UpdateProfileService;
