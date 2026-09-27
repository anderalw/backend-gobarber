import { hash } from 'bcryptjs';
import { injectable, inject } from 'tsyringe';
import AppError from '@shared/errors/AppError';
import Client from '../infra/typeorm/entities/Client';
import IClientsRepository from '../repositories/IClientsRepository';

@injectable()
class CreateClientService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,
  ) {}

  public async execute({ name, email, password, phone }: any): Promise<Client> {
    const checkClientExists = await this.clientsRepository.findByEmail(email);

    if (checkClientExists) {
      throw new AppError('Este e-mail já está em uso.');
    }

    const hashedPassword = await hash(password, 8);

    const client = await this.clientsRepository.create({
      name,
      email,
      password: hashedPassword,
      phone,
    });

    return client;
  }
}

export default CreateClientService;