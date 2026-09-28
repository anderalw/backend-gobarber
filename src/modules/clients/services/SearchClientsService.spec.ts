import FakeClientsRepository from '../repositories/fakes/FakeClientsRepository';
import SearchClientsService from './SearchClientsService';

let fakeClientsRepository: FakeClientsRepository;
let searchClients: SearchClientsService;

describe('SearchClients', () => {
  beforeEach(async () => {
    fakeClientsRepository = new FakeClientsRepository();
    searchClients = new SearchClientsService(fakeClientsRepository);

    await fakeClientsRepository.create({
      name: 'Maria Souza',
      email: 'maria@example.com',
      password: '123456',
      phone: '11999990000',
    });
    await fakeClientsRepository.create({
      name: 'Mário Lima',
      email: 'mario@example.com',
      password: '123456',
      phone: '11888880000',
    });
  });

  it('should find clients by name, e-mail or phone', async () => {
    expect((await searchClients.execute('souza')).map(c => c.name)).toEqual([
      'Maria Souza',
    ]);
    expect((await searchClients.execute('mario@')).map(c => c.name)).toEqual([
      'Mário Lima',
    ]);
    expect((await searchClients.execute('8888')).map(c => c.name)).toEqual([
      'Mário Lima',
    ]);
  });

  it('should need at least two characters', async () => {
    expect(await searchClients.execute(' m ')).toEqual([]);
  });
});
