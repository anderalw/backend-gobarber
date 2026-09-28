import AppError from '@shared/errors/AppError';
import FakeClientsRepository from '../repositories/fakes/FakeClientsRepository';
import CreateClientService from './CreateClientService';

let fakeClientsRepository: FakeClientsRepository;
let createClient: CreateClientService;

describe('CreateClient', () => {
  beforeEach(() => {
    fakeClientsRepository = new FakeClientsRepository();
    createClient = new CreateClientService(fakeClientsRepository);
  });

  it('should create a client account', async () => {
    const client = await createClient.execute({
      name: 'Maria',
      email: 'maria@example.com',
      password: '123456',
      phone: '11999990000',
    });

    expect(client.id).toBeDefined();
    expect(client.password).not.toBe('123456');
  });

  it('should not create two accounts with the same e-mail', async () => {
    await createClient.execute({
      name: 'Maria',
      email: 'maria@example.com',
      password: '123456',
      phone: '1',
    });

    await expect(
      createClient.execute({
        name: 'Outra',
        email: 'maria@example.com',
        password: '654321',
        phone: '2',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('should complete a client registered by a barber', async () => {
    const registered = await fakeClientsRepository.create({
      name: 'Maria (balcão)',
      email: 'maria@example.com',
      password: null,
      phone: '1',
    });

    const client = await createClient.execute({
      name: 'Maria Souza',
      email: 'maria@example.com',
      password: '123456',
      phone: '11999990000',
    });

    // Mesmo cadastro (mantém os agendamentos), agora com senha e dados novos
    expect(client.id).toBe(registered.id);
    expect(client).toMatchObject({
      name: 'Maria Souza',
      phone: '11999990000',
    });
    expect(client.password).toBeTruthy();
  });
});
