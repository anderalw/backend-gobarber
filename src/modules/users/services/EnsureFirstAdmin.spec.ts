import FakeUsersRepository from '../repositories/fakes/FakeUsersRepository';
import FakeHashProvider from '../providers/HashProvider/fakes/FakeHashProvider';
import EnsureFirstAdminService from './EnsureFirstAdminService';

let usersRepository: FakeUsersRepository;
let ensureFirstAdmin: EnsureFirstAdminService;

describe('Primeiro administrador', () => {
  beforeEach(() => {
    usersRepository = new FakeUsersRepository();
    ensureFirstAdmin = new EnsureFirstAdminService(
      usersRepository,
      new FakeHashProvider(),
    );
  });

  it('should create the first admin on an empty database', async () => {
    const email = await ensureFirstAdmin.execute({
      name: 'Dono',
      email: 'Dono@Barbearia.com.br',
      password: 'segredo123',
    });

    expect(email).toBe('dono@barbearia.com.br');

    const user = await usersRepository.findByEmail('dono@barbearia.com.br');

    expect(user).toMatchObject({ name: 'Dono', is_admin: true });
    // A senha fica só o hash
    expect(user?.password).not.toBe('');
  });

  it('should do nothing when someone is already registered', async () => {
    await usersRepository.create({
      name: 'Barbeiro',
      email: 'barbeiro@barbearia.com.br',
      password: 'hash',
    });

    expect(
      await ensureFirstAdmin.execute({
        email: 'dono@barbearia.com.br',
        password: 'segredo123',
      }),
    ).toBeNull();
    expect(
      await usersRepository.findByEmail('dono@barbearia.com.br'),
    ).toBeUndefined();
  });

  it('should do nothing without the variables and refuse short passwords', async () => {
    expect(await ensureFirstAdmin.execute({})).toBeNull();

    await expect(
      ensureFirstAdmin.execute({
        email: 'dono@barbearia.com.br',
        password: '123',
      }),
    ).rejects.toThrow('ADMIN_PASSWORD');
  });
});
