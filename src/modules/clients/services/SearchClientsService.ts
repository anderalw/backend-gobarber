import { injectable, inject } from 'tsyringe';

import Client from '../infra/typeorm/entities/Client';
import IClientsRepository from '../repositories/IClientsRepository';

const MAX_RESULTS = 10;

// Busca de clientes para o barbeiro escolher ao marcar pela agenda
@injectable()
class SearchClientsService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,
  ) {}

  public async execute(term: string): Promise<Client[]> {
    const search = term.trim();

    // Com menos de 2 letras a lista seria grande demais para ajudar
    if (search.length < 2) {
      return [];
    }

    return this.clientsRepository.search(search, MAX_RESULTS);
  }
}

export default SearchClientsService;
