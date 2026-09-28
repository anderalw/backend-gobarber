import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import Client from '../infra/typeorm/entities/Client';
import IClientsRepository from '../repositories/IClientsRepository';

interface IRequest {
  name: string;
  phone: string;
  email?: string | null;
}

// Cadastro rápido feito pelo barbeiro ao marcar pela agenda. O cliente fica
// sem senha até criar a conta no site com o mesmo e-mail
@injectable()
class CreateClientByProviderService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,
  ) {}

  public async execute({ name, phone, email }: IRequest): Promise<Client> {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email?.trim().toLowerCase() || null;

    if (!cleanName || !cleanPhone) {
      throw new AppError('Informe o nome e o telefone do cliente.');
    }

    if (cleanEmail && (await this.clientsRepository.findByEmail(cleanEmail))) {
      throw new AppError(
        'Já existe um cliente com este e-mail. Busque por ele na lista.',
      );
    }

    return this.clientsRepository.create({
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      password: null,
    });
  }
}

export default CreateClientByProviderService;
