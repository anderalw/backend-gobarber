import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import Client from '../infra/typeorm/entities/Client';
import IClientsRepository from '../repositories/IClientsRepository';

interface IRequest {
  client_id: string;
  name: string;
  phone: string;
}

// O próprio cliente atualiza o nome e o telefone (ex: depois do primeiro
// login com Google, que não traz o telefone)
@injectable()
class UpdateOwnClientService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,
  ) {}

  public async execute({ client_id, name, phone }: IRequest): Promise<Client> {
    const client = await this.clientsRepository.findById(client_id);

    if (!client) {
      throw new AppError('Cliente não encontrado.', 404);
    }

    const cleanName = name.trim().replace(/\s+/g, ' ');
    const digits = phone.replace(/\D/g, '');

    if (cleanName.length < 2) {
      throw new AppError('Informe o seu nome.');
    }

    if (digits.length < 10 || digits.length > 13) {
      throw new AppError('Informe o telefone com DDD. Ex: (11) 99999-0000');
    }

    client.name = cleanName;
    client.phone = digits;

    return this.clientsRepository.save(client);
  }
}

export default UpdateOwnClientService;
