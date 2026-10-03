import { decode } from 'jsonwebtoken';

import AppError from '@shared/errors/AppError';
import FakeCacheProvider from '@shared/container/providers/CacheProvider/fakes/FakeCacheProvider';
import FakeAppointmentsRepository from '@modules/appointments/repositories/fakes/FakeAppointmentsRepository';
import FakeUsersRepository from '../repositories/fakes/FakeUsersRepository';
import FakeRolesRepository from '../repositories/fakes/FakeRolesRepository';
import FakeHashProvider from '../providers/HashProvider/fakes/FakeHashProvider';
import Role from '../infra/typeorm/entities/Role';
import { ALL_PERMISSIONS, DEFAULT_ROLES } from '../permissions';
import RolesService from './RolesService';
import StaffUsersService from './StaffUsersService';
import BarbersService from './BarbersService';
import SetProviderActiveService from './SetProviderActiveService';
import AuthenticateUserService from './AuthenticateUserService';
import ChangeFirstPasswordService from './ChangeFirstPasswordService';

let usersRepository: FakeUsersRepository;
let rolesRepository: FakeRolesRepository;
let appointmentsRepository: FakeAppointmentsRepository;
let hashProvider: FakeHashProvider;
let roles: RolesService;
let staff: StaffUsersService;
let barbers: BarbersService;
let setActive: SetProviderActiveService;
let admin: Role;
let reception: Role;
let barber: Role;

describe('Usuários, perfis e barbeiros', () => {
  beforeEach(async () => {
    usersRepository = new FakeUsersRepository();
    rolesRepository = new FakeRolesRepository();
    appointmentsRepository = new FakeAppointmentsRepository();
    hashProvider = new FakeHashProvider();
    const cache = new FakeCacheProvider();

    roles = new RolesService(rolesRepository, usersRepository);
    staff = new StaffUsersService(
      usersRepository,
      rolesRepository,
      hashProvider,
      cache,
    );
    barbers = new BarbersService(
      usersRepository,
      appointmentsRepository,
      cache,
    );
    setActive = new SetProviderActiveService(
      usersRepository,
      appointmentsRepository,
      cache,
    );

    [admin, reception, barber] = await Promise.all(
      DEFAULT_ROLES.map(role => rolesRepository.create(role)),
    );
  });

  async function createAdmin() {
    const user = await usersRepository.create({
      name: 'Dono',
      email: 'dono@barbearia.com.br',
      password: 'x',
      role_id: admin.id,
    });

    user.role = admin;

    return user;
  }

  const maria = (data = {}) =>
    staff.create({ name: 'Maria', email: 'maria@barbearia.com.br', ...data });

  it('should give every permission to the admin role', () => {
    expect(admin.allowed).toEqual(ALL_PERMISSIONS);
    expect(reception.allowed).toContain('agenda.manage');
    expect(barber.allowed).toEqual([]);
  });

  it('should create, edit and protect roles', async () => {
    const finance = await roles.create({
      name: ' Financeiro ',
      permissions: ['reports', 'cash', 'reports'],
    });

    expect(finance).toMatchObject({
      name: 'Financeiro',
      permissions: ['reports', 'cash'],
      users: 0,
    });

    await expect(
      roles.create({ name: 'financeiro', permissions: [] }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      roles.create({ name: 'X', permissions: ['voar'] }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      roles.update(admin.id, { name: 'Chefe', permissions: [] }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(roles.remove(admin.id)).rejects.toBeInstanceOf(AppError);

    const updated = await roles.update(finance.id, {
      name: 'Caixa',
      permissions: ['cash'],
    });

    expect(updated).toMatchObject({ name: 'Caixa', permissions: ['cash'] });

    // O Administrador vem primeiro na lista
    expect((await roles.list())[0].is_admin).toBe(true);
  });

  it('should not delete a role in use', async () => {
    await maria({ role_id: reception.id });

    await expect(roles.remove(reception.id)).rejects.toBeInstanceOf(AppError);
    await expect(roles.remove(barber.id)).resolves.toBeUndefined();
  });

  it('should create users without a role, with the e-mail as password', async () => {
    const generateHash = jest.spyOn(hashProvider, 'generateHash');

    const user = await staff.create({
      name: ' Maria ',
      email: 'Maria@Barbearia.com.br',
    });

    expect(user).toMatchObject({
      name: 'Maria',
      email: 'maria@barbearia.com.br',
      is_barber: false,
      must_change_password: true,
      role: null,
      permissions: [],
    });
    expect(generateHash).toHaveBeenCalledWith('maria@barbearia.com.br');

    await expect(
      staff.create({ name: 'Outra', email: 'maria@barbearia.com.br' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should add the user own permissions to the role ones', async () => {
    const owner = await createAdmin();
    const created = await maria({ role_id: barber.id, permissions: ['cash'] });

    expect(created.permissions).toEqual(['cash']);

    const updated = await staff.update(owner.id, created.id, {
      name: 'Maria',
      email: 'maria@barbearia.com.br',
      role_id: reception.id,
      permissions: ['reports', 'clients'],
    });

    // Recepção + as próprias, sem repetir
    expect(updated.own_permissions).toEqual(['reports', 'clients']);
    expect(updated.permissions).toEqual(
      expect.arrayContaining([...reception.allowed, 'reports']),
    );
    expect(new Set(updated.permissions).size).toBe(updated.permissions.length);

    await expect(
      staff.update(owner.id, created.id, {
        name: 'Maria',
        email: 'maria@barbearia.com.br',
        role_id: null,
        permissions: ['voar'],
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should keep at least one admin and not let users change their own access', async () => {
    const owner = await createAdmin();
    const same = {
      name: 'Dono',
      email: owner.email,
      role_id: admin.id,
      permissions: [],
    };

    // O próprio nome pode; o próprio acesso, não
    await expect(staff.update(owner.id, owner.id, same)).resolves.toBeTruthy();
    await expect(
      staff.update(owner.id, owner.id, { ...same, role_id: barber.id }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      staff.update(owner.id, owner.id, { ...same, permissions: ['cash'] }),
    ).rejects.toBeInstanceOf(AppError);

    const other = await maria({ role_id: reception.id });

    // Único admin: não pode ser rebaixado nem desativado
    await expect(
      staff.update(other.id, owner.id, { ...same, role_id: barber.id }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      setActive.execute({
        requester_id: other.id,
        provider_id: owner.id,
        active: false,
      }),
    ).rejects.toBeInstanceOf(AppError);

    // Com outro admin, pode
    await staff.update(owner.id, other.id, {
      name: 'Maria',
      email: 'maria@barbearia.com.br',
      role_id: admin.id,
      permissions: [],
    });

    await expect(
      staff.update(other.id, owner.id, { ...same, role_id: barber.id }),
    ).resolves.toMatchObject({ role: { name: 'Barbeiro' } });
  });

  it('should reset the password to the e-mail', async () => {
    const owner = await createAdmin();
    const created = await maria();
    const user = await usersRepository.findById(created.id);

    if (user) user.must_change_password = false;

    await expect(
      staff.resetPassword(owner.id, owner.id),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      staff.resetPassword(owner.id, created.id),
    ).resolves.toMatchObject({ must_change_password: true });
  });

  it('should force the first password change', async () => {
    const created = await maria();
    const authenticate = new AuthenticateUserService(
      usersRepository,
      hashProvider,
    );
    const changePassword = new ChangeFirstPasswordService(
      usersRepository,
      hashProvider,
    );

    // Entra com o e-mail (até com maiúsculas), com o token restrito
    const first = await authenticate.execute({
      email: 'maria@barbearia.com.br',
      password: 'Maria@Barbearia.com.br',
    });

    expect(decode(first.token)).toMatchObject({ pwd: true });

    await expect(
      changePassword.execute(created.id, 'maria@barbearia.com.br'),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      changePassword.execute(created.id, '123'),
    ).rejects.toBeInstanceOf(AppError);

    const changed = await changePassword.execute(created.id, 'senha-nova');

    expect(changed.user.must_change_password).toBe(false);
    expect(decode(changed.token)).not.toHaveProperty('pwd');

    // A senha provisória não vale mais
    await expect(
      authenticate.execute({
        email: 'maria@barbearia.com.br',
        password: 'maria@barbearia.com.br',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should turn users into barbers and back', async () => {
    const created = await maria();

    expect(await usersRepository.findAllProviders({})).toHaveLength(0);

    await barbers.add(created.id);

    expect(
      (await usersRepository.findAllProviders({})).map(user => user.id),
    ).toEqual([created.id]);
    await expect(barbers.add(created.id)).rejects.toBeInstanceOf(AppError);

    await barbers.remove(created.id);

    expect(await usersRepository.findAllProviders({})).toHaveLength(0);
    await expect(barbers.remove(created.id)).rejects.toBeInstanceOf(AppError);
  });

  it('should not remove a barber with upcoming appointments', async () => {
    const created = await maria();

    await barbers.add(created.id);

    jest
      .spyOn(appointmentsRepository, 'countUpcomingFromProvider')
      .mockResolvedValue(2);

    await expect(barbers.remove(created.id)).rejects.toBeInstanceOf(AppError);
  });

  it('should not make an inactive user a barber', async () => {
    const owner = await createAdmin();
    const created = await maria();

    await setActive.execute({
      requester_id: owner.id,
      provider_id: created.id,
      active: false,
    });

    await expect(barbers.add(created.id)).rejects.toBeInstanceOf(AppError);
  });
});
