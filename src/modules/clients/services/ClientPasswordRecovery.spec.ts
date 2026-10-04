import AppError from '@shared/errors/AppError';
import FakeMailProvider from '@shared/container/providers/MailProvider/fakes/FakeMailProvider';
import FakeHashProvider from '@modules/users/providers/HashProvider/fakes/FakeHashProvider';
import FakeSettingsRepository from '@modules/catalog/repositories/fakes/FakeSettingsRepository';
import BrandingService from '@modules/catalog/services/BrandingService';
import FakeStorageProvider from '@shared/container/providers/StorageProvider/fakes/FakeStorageProvider';
import FakeClientsRepository from '../repositories/fakes/FakeClientsRepository';
import FakeClientTokensRepository from '../repositories/fakes/FakeClientTokensRepository';
import ClientPasswordRecoveryService from './ClientPasswordRecoveryService';

let fakeClientsRepository: FakeClientsRepository;
let fakeClientTokensRepository: FakeClientTokensRepository;
let fakeMailProvider: FakeMailProvider;
let recovery: ClientPasswordRecoveryService;

describe('Recuperação de senha do cliente', () => {
  beforeEach(() => {
    fakeClientsRepository = new FakeClientsRepository();
    fakeClientTokensRepository = new FakeClientTokensRepository();
    fakeMailProvider = new FakeMailProvider();

    recovery = new ClientPasswordRecoveryService(
      fakeClientsRepository,
      fakeClientTokensRepository,
      fakeMailProvider,
      new FakeHashProvider(),
      new BrandingService(
        new FakeSettingsRepository(),
        new FakeStorageProvider(),
      ),
    );
  });

  it('should send the link and set a new password once', async () => {
    const client = await fakeClientsRepository.create({
      name: 'Rafael',
      email: 'rafael@example.test',
      phone: '11999990000',
      password: 'antiga',
    });
    const sendMail = jest.spyOn(fakeMailProvider, 'sendMail');
    const generate = jest.spyOn(fakeClientTokensRepository, 'generate');

    await recovery.sendLink('Rafael@Example.test');

    expect(sendMail).toHaveBeenCalled();

    const { token } = await generate.mock.results[0].value;

    await recovery.reset(token, 'nova-senha');

    expect(client.password).toBe('nova-senha');
    await expect(recovery.reset(token, 'outra')).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('should not tell whether the e-mail exists', async () => {
    const sendMail = jest.spyOn(fakeMailProvider, 'sendMail');

    await expect(
      recovery.sendLink('ninguem@example.test'),
    ).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('should not accept an expired link', async () => {
    const client = await fakeClientsRepository.create({
      name: 'Rafael',
      email: 'rafael@example.test',
      phone: '11999990000',
      password: 'antiga',
    });
    const { token } = await fakeClientTokensRepository.generate(client.id);

    jest
      .spyOn(Date, 'now')
      .mockImplementationOnce(() => Date.now() + 3 * 60 * 60 * 1000);

    await expect(recovery.reset(token, 'nova')).rejects.toBeInstanceOf(
      AppError,
    );
  });
});
