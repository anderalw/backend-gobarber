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

let usersRepository: FakeUsersRepository;
let rolesRepository: FakeRolesRepository;
let appointmentsRepository: FakeAppointmentsRepository;
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
    const cache = new FakeCacheProvider();

    roles = new RolesService(rolesRepository, usersRepository);
    staff = new StaffUsersService(
      usersRepository,
      rolesRepository,
      new FakeHashProvider(),
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
    await staff.create({
      name: 'Maria',
      email: 'maria@barbearia.com.br',
      password: 'segredo',
      role_id: reception.id,
    });

    await expect(roles.remove(reception.id)).rejects.toBeInstanceOf(AppError);
    await expect(roles.remove(barber.id)).resolves.toBeUndefined();
  });

  it('should create users that are not barbers', async () => {
    const maria = await staff.create({
      name: ' Maria ',
      email: 'Maria@Barbearia.com.br',
      password: 'segredo',
      role_id: reception.id,
    });

    expect(maria).toMatchObject({
      name: 'Maria',
      email: 'maria@barbearia.com.br',
      is_barber: false,
      role: { name: 'Recepção', is_admin: false },
    });

    await expect(
      staff.create({
        name: 'Outra',
        email: 'maria@barbearia.com.br',
        password: 'segredo',
        role_id: reception.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      staff.create({
        name: 'Curta',
        email: 'curta@barbearia.com.br',
        password: '123',
        role_id: reception.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should keep at least one admin and not let users change their own role', async () => {
    const owner = await createAdmin();

    await expect(
      staff.update(owner.id, owner.id, {
        name: 'Dono',
        email: owner.email,
        role_id: barber.id,
      }),
    ).rejects.toBeInstanceOf(AppError);

    const maria = await staff.create({
      name: 'Maria',
      email: 'maria@barbearia.com.br',
      password: 'segredo',
      role_id: reception.id,
    });

    // Único admin: outro admin não consegue rebaixá-lo
    await expect(
      staff.update(maria.id, owner.id, {
        name: 'Dono',
        email: owner.email,
        role_id: barber.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      setActive.execute({
        requester_id: maria.id,
        provider_id: owner.id,
        active: false,
      }),
    ).rejects.toBeInstanceOf(AppError);

    // Com outro admin, pode
    await staff.update(owner.id, maria.id, {
      name: 'Maria',
      email: 'maria@barbearia.com.br',
      role_id: admin.id,
      password: 'nova-senha',
    });

    await expect(
      staff.update(maria.id, owner.id, {
        name: 'Dono',
        email: owner.email,
        role_id: barber.id,
      }),
    ).resolves.toMatchObject({ role: { name: 'Barbeiro' } });
  });

  it('should turn users into barbers and back', async () => {
    const maria = await staff.create({
      name: 'Maria',
      email: 'maria@barbearia.com.br',
      password: 'segredo',
      role_id: reception.id,
    });

    expect(await usersRepository.findAllProviders({})).toHaveLength(0);

    await barbers.add(maria.id);

    expect(
      (await usersRepository.findAllProviders({})).map(user => user.id),
    ).toEqual([maria.id]);
    await expect(barbers.add(maria.id)).rejects.toBeInstanceOf(AppError);

    await barbers.remove(maria.id);

    expect(await usersRepository.findAllProviders({})).toHaveLength(0);
    await expect(barbers.remove(maria.id)).rejects.toBeInstanceOf(AppError);
  });

  it('should not remove a barber with upcoming appointments', async () => {
    const maria = await staff.create({
      name: 'Maria',
      email: 'maria@barbearia.com.br',
      password: 'segredo',
      role_id: reception.id,
    });

    await barbers.add(maria.id);

    jest
      .spyOn(appointmentsRepository, 'countUpcomingFromProvider')
      .mockResolvedValue(2);

    await expect(barbers.remove(maria.id)).rejects.toBeInstanceOf(AppError);
  });

  it('should not make an inactive user a barber', async () => {
    const owner = await createAdmin();
    const maria = await staff.create({
      name: 'Maria',
      email: 'maria@barbearia.com.br',
      password: 'segredo',
      role_id: reception.id,
    });

    await setActive.execute({
      requester_id: owner.id,
      provider_id: maria.id,
      active: false,
    });

    await expect(barbers.add(maria.id)).rejects.toBeInstanceOf(AppError);
  });
});
