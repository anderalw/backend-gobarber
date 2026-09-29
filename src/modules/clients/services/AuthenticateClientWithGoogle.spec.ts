import { verify } from 'jsonwebtoken';

import AppError from '@shared/errors/AppError';
import authConfig from '@config/auth';
import FakeClientsRepository from '../repositories/fakes/FakeClientsRepository';
import FakeGoogleTokenProvider from '../providers/GoogleTokenProvider/fakes/FakeGoogleTokenProvider';
import AuthenticateClientWithGoogleService from './AuthenticateClientWithGoogleService';
import UpdateOwnClientService from './UpdateOwnClientService';

let fakeClientsRepository: FakeClientsRepository;
let fakeGoogle: FakeGoogleTokenProvider;
let authenticate: AuthenticateClientWithGoogleService;

const maria = {
  sub: 'google-maria',
  email: 'Maria@Gmail.com',
  email_verified: true,
  name: 'Maria Souza',
};

describe('Login do cliente com Google', () => {
  beforeEach(() => {
    fakeClientsRepository = new FakeClientsRepository();
    fakeGoogle = new FakeGoogleTokenProvider();
    authenticate = new AuthenticateClientWithGoogleService(
      fakeClientsRepository,
      fakeGoogle,
    );

    fakeGoogle.addToken('token-maria', maria);
  });

  it('should create the client on the first login, without a phone', async () => {
    const { client, token, created } = await authenticate.execute(
      'token-maria',
    );

    expect(created).toBe(true);
    expect(client).toMatchObject({
      name: 'Maria Souza',
      email: 'maria@gmail.com',
      password: null,
      phone: '',
      google_id: 'google-maria',
    });
    // Mesmo token do login com senha: papel de cliente
    expect(verify(token, authConfig.jwt.secret)).toMatchObject({
      role: 'client',
      sub: client.id,
    });

    // Na segunda vez, entra na mesma conta
    const again = await authenticate.execute('token-maria');

    expect(again.created).toBe(false);
    expect(again.client.id).toBe(client.id);
  });

  it('should link to the client that already has the e-mail', async () => {
    // Cadastrada pela barbearia, sem conta no site
    const existing = await fakeClientsRepository.create({
      name: 'Maria',
      email: 'maria@gmail.com',
      password: null,
      phone: '11999990000',
    });

    const { client, created } = await authenticate.execute('token-maria');

    expect(created).toBe(false);
    expect(client.id).toBe(existing.id);
    expect(client).toMatchObject({
      google_id: 'google-maria',
      // O telefone e o nome cadastrados continuam
      phone: '11999990000',
      name: 'Maria',
    });
  });

  it('should refuse unconfirmed e-mails and invalid tokens', async () => {
    fakeGoogle.addToken('token-nao-confirmado', {
      ...maria,
      sub: 'outro',
      email_verified: false,
    });

    await expect(
      authenticate.execute('token-nao-confirmado'),
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(authenticate.execute('falso')).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('should let the client add the phone afterwards', async () => {
    const { client } = await authenticate.execute('token-maria');
    const updateOwn = new UpdateOwnClientService(fakeClientsRepository);

    const updated = await updateOwn.execute({
      client_id: client.id,
      name: ' Maria  Souza ',
      phone: '(11) 98888-7777',
    });

    expect(updated).toMatchObject({
      name: 'Maria Souza',
      phone: '11988887777',
    });

    await expect(
      updateOwn.execute({ client_id: client.id, name: 'Maria', phone: '123' }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
