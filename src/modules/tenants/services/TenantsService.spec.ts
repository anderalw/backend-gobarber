import AppError from '@shared/errors/AppError';
import { currentTenant } from '@shared/tenancy/TenantContext';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import FakeNotificationsRepository from '@modules/notifications/repositories/fakes/FakeNotificationsRepository';
import FakeUsersRepository from '@modules/users/repositories/fakes/FakeUsersRepository';
import FakeHashProvider from '@modules/users/providers/HashProvider/fakes/FakeHashProvider';
import EnsureFirstAdminService from '@modules/users/services/EnsureFirstAdminService';
import FakeBlockReasonsRepository from '@modules/appointments/repositories/fakes/FakeBlockReasonsRepository';
import FakeTenantsRepository from '../repositories/fakes/FakeTenantsRepository';
import SeedTenantDefaultsService from './SeedTenantDefaultsService';
import TenantsService from './TenantsService';
import ResolveTenantService from './ResolveTenantService';

let tenantsRepository: FakeTenantsRepository;
let settingsRepository: FakeSettingsRepository;
let blockReasonsRepository: FakeBlockReasonsRepository;
let usersRepository: FakeUsersRepository;
let ensureFirstAdmin: EnsureFirstAdminService;
let tenants: TenantsService;

const admin = {
  name: 'Zé',
  email: 'ze@barbeariadoze.com.br',
  password: 'segredo123',
};

describe('Cadastro das barbearias', () => {
  beforeEach(() => {
    tenantsRepository = new FakeTenantsRepository();
    settingsRepository = new FakeSettingsRepository();
    blockReasonsRepository = new FakeBlockReasonsRepository();
    usersRepository = new FakeUsersRepository();
    ensureFirstAdmin = new EnsureFirstAdminService(
      usersRepository,
      new FakeHashProvider(),
    );
    tenants = new TenantsService(
      tenantsRepository,
      new SeedTenantDefaultsService(settingsRepository, blockReasonsRepository),
      new FakeNotificationsRepository(),
      ensureFirstAdmin,
    );
  });

  it('should create a barbershop with its name and first admin', async () => {
    let tenantDuringSetup: string | undefined;
    const execute = ensureFirstAdmin.execute.bind(ensureFirstAdmin);

    jest.spyOn(ensureFirstAdmin, 'execute').mockImplementation(data => {
      tenantDuringSetup = currentTenant()?.id;
      return execute(data);
    });

    const tenant = await tenants.create({
      slug: ' Barbearia-do-Ze ',
      name: 'Barbearia do Zé',
      admin,
    });

    expect(tenant).toMatchObject({ slug: 'barbearia-do-ze', status: 'active' });
    // O administrador e o nome são gravados dentro da barbearia nova
    expect(tenantDuringSetup).toBe(tenant.id);
    expect(await settingsRepository.get('shop_name')).toBe('Barbearia do Zé');
    // Começa com os motivos de bloqueio padrão
    expect(
      (await blockReasonsRepository.findAll()).map(reason => reason.name),
    ).toEqual(
      expect.arrayContaining(['Almoço', 'Consulta', 'Folga', 'Férias']),
    );
    expect(await usersRepository.findByEmail(admin.email)).toMatchObject({
      is_admin: true,
    });
  });

  it('should reject invalid, reserved and repeated identifiers', async () => {
    await expect(
      tenants.create({ slug: 'com espaço', name: 'X', admin }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      tenants.create({ slug: 'painel', name: 'X', admin }),
    ).rejects.toBeInstanceOf(AppError);

    await tenants.create({ slug: 'ze', name: 'Zé', admin });

    await expect(
      tenants.create({ slug: 'ze', name: 'Outro', admin }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should undo the barbershop when the admin cannot be created', async () => {
    jest
      .spyOn(ensureFirstAdmin, 'execute')
      .mockRejectedValue(new Error('falhou'));

    await expect(
      tenants.create({ slug: 'ze', name: 'Zé', admin }),
    ).rejects.toThrow('falhou');

    expect(await tenantsRepository.findAll()).toHaveLength(0);
  });

  it('should validate custom domains', async () => {
    const tenant = await tenants.create({
      slug: 'ze',
      name: 'Zé',
      custom_domain: 'https://WWW.BarbeariaDoZe.com.br/',
      admin,
    });

    expect(tenant.custom_domain).toBe('www.barbeariadoze.com.br');

    const other = await tenants.create({ slug: 'cia', name: 'Cia', admin });

    // O mesmo domínio, mesmo sem o www, já é de outra barbearia
    await expect(
      tenants.update(other.id, { custom_domain: 'barbeariadoze.com.br' }),
    ).rejects.toBeInstanceOf(AppError);
    // Endereço do próprio Pontual não é domínio próprio
    await expect(
      tenants.update(other.id, { custom_domain: 'cia.localhost' }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      tenants.update(other.id, { custom_domain: 'não é domínio' }),
    ).rejects.toBeInstanceOf(AppError);

    // A própria barbearia pode salvar o domínio dela de novo
    await expect(
      tenants.update(tenant.id, { custom_domain: 'barbeariadoze.com.br' }),
    ).resolves.toMatchObject({ custom_domain: 'barbeariadoze.com.br' });
  });

  it('should suspend, rename and remove a barbershop', async () => {
    const tenant = await tenants.create({ slug: 'ze', name: 'Zé', admin });

    await tenants.update(tenant.id, { status: 'suspended', name: ' Zé 2 ' });

    expect(await tenants.show(tenant.id)).toMatchObject({
      status: 'suspended',
      name: 'Zé 2',
    });

    await tenants.remove(tenant.id);

    await expect(tenants.show(tenant.id)).rejects.toBeInstanceOf(AppError);
  });

  it('should find the barbershop of an address', async () => {
    const resolve = new ResolveTenantService(tenantsRepository);
    const tenant = await tenants.create({
      slug: 'ze',
      name: 'Zé',
      custom_domain: 'barbeariadoze.com.br',
      admin,
    });

    expect(await resolve.execute('ze.localhost')).toBe(tenant);
    expect(await resolve.execute('www.barbeariadoze.com.br:443')).toBe(tenant);
    expect(await resolve.execute('nada.localhost')).toBeNull();
    // Sem DEFAULT_TENANT, o endereço principal não é de ninguém
    expect(await resolve.execute('localhost')).toBeNull();

    await tenants.remove(tenant.id);

    expect(await resolve.execute('ze.localhost')).toBeNull();
  });
});
