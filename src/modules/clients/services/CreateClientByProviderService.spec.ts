import AppError from '@shared/errors/AppError';
import FakeClientsRepository from '../repositories/fakes/FakeClientsRepository';
import CreateClientByProviderService from './CreateClientByProviderService';

let fakeClientsRepository: FakeClientsRepository;
let createClient: CreateClientByProviderService;

describe('CreateClientByProvider', () => {
  beforeEach(() => {
    fakeClientsRepository = new FakeClientsRepository();
    createClient = new CreateClientByProviderService(fakeClientsRepository);
  });

  it('should register a client without password', async () => {
    const client = await createClient.execute({
      name: '  João da Silva ',
      phone: ' 11 98888-7777 ',
      email: ' Joao@Example.com ',
    });

    expect(client).toMatchObject({
      name: 'João da Silva',
      phone: '11 98888-7777',
      email: 'joao@example.com',
      password: null,
    });
  });

  it('should allow registering without e-mail', async () => {
    const client = await createClient.execute({
      name: 'João',
      phone: '11 98888-7777',
      email: '',
    });

    expect(client.email).toBeNull();
  });

  it('should not register an e-mail already in use', async () => {
    await createClient.execute({
      name: 'João',
      phone: '1',
      email: 'joao@example.com',
    });

    await expect(
      createClient.execute({
        name: 'Outro',
        phone: '2',
        email: 'joao@example.com',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should require name and phone', async () => {
    await expect(
      createClient.execute({ name: ' ', phone: '11 9' }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      createClient.execute({ name: 'João', phone: ' ' }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
