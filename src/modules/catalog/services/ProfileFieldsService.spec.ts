import AppError from '@shared/errors/AppError';
import { isValidCpf } from '@shared/utils/documents';
import FakeClientsRepository from '@modules/clients/repositories/fakes/FakeClientsRepository';
import SaveClientExtrasService from '@modules/clients/services/SaveClientExtrasService';
import FakeSettingsRepository from '../repositories/fakes/FakeSettingsRepository';
import ProfileFieldsService, {
  IProfileFieldRules,
} from './ProfileFieldsService';

let fields: ProfileFieldsService;

const address = {
  cep: '01310-100',
  street: ' Av. Paulista ',
  number: '1000',
  complement: '',
  district: 'Bela Vista',
  city: 'São Paulo',
  state: 'sp',
};

describe('Campos dos cadastros', () => {
  beforeEach(() => {
    fields = new ProfileFieldsService(new FakeSettingsRepository());
  });

  it('should validate CPF check digits', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });

  it('should start with only the e-mail shown at the counter', async () => {
    const rules = await fields.get();

    expect(rules.client_site.cpf).toEqual({ show: false, required: false });
    expect(rules.client_counter.email).toEqual({ show: true, required: false });
    expect(rules.staff.phone).toEqual({ show: true, required: false });
  });

  it('should ignore hidden fields', async () => {
    await expect(
      fields.check('client_site', { cpf: '123', birth_date: 'x' }),
    ).resolves.toEqual({});
  });

  it('should require and validate shown fields', async () => {
    const rules = await fields.get();

    await fields.update({
      ...rules,
      client_counter: {
        ...rules.client_counter,
        cpf: { show: true, required: true },
        birth_date: { show: true, required: false },
        address: { show: true, required: false },
      },
    });

    await expect(
      fields.check('client_counter', { birth_date: '1990-05-10' }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      fields.check('client_counter', { cpf: '529.982.247-24' }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      fields.check('client_counter', {
        cpf: '52998224725',
        birth_date: '2999-01-01',
      }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      fields.check('client_counter', {
        cpf: '52998224725',
        address: { ...address, number: '' },
      }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      fields.check('client_counter', {
        cpf: '529.982.247-25',
        birth_date: '1990-05-10',
        address,
        email: ' Ze@Barbearia.com ',
      }),
    ).resolves.toEqual({
      cpf: '52998224725',
      birth_date: '1990-05-10',
      address: {
        cep: '01310100',
        street: 'Av. Paulista',
        number: '1000',
        complement: null,
        district: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      },
      email: 'Ze@Barbearia.com',
    });

    // Vazio num campo opcional apaga; não vir mantém
    await expect(
      fields.check('client_counter', { cpf: '52998224725', birth_date: '' }),
    ).resolves.toEqual({ cpf: '52998224725', birth_date: null });
  });

  it('should only require shown fields', async () => {
    const saved = await fields.update({
      client_site: { cpf: { show: false, required: true } },
      client_counter: {},
      staff: { phone: { show: true, required: true } },
    } as unknown as IProfileFieldRules);

    expect(saved.client_site.cpf).toEqual({ show: false, required: false });
    expect(saved.staff.phone).toEqual({ show: true, required: true });
    await expect(fields.check('staff', {})).rejects.toBeInstanceOf(AppError);
  });

  it('should not let two clients share a CPF', async () => {
    const clients = new FakeClientsRepository();
    const extras = new SaveClientExtrasService(clients);
    const ze = await clients.create({
      name: 'Zé',
      phone: '1',
      email: null,
      password: null,
    });
    const cia = await clients.create({
      name: 'Cia',
      phone: '2',
      email: null,
      password: null,
    });

    await extras.execute(ze, { cpf: '52998224725' });

    expect(ze.cpf).toBe('52998224725');
    await expect(
      extras.execute(cia, { cpf: '52998224725' }),
    ).rejects.toBeInstanceOf(AppError);
    // O próprio cliente pode salvar o mesmo CPF de novo
    await expect(
      extras.execute(ze, { cpf: '52998224725', birth_date: null }),
    ).resolves.toMatchObject({ birth_date: null });
  });
});
