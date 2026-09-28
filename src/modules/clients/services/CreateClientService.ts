import { hash } from 'bcryptjs';
import { injectable, inject } from 'tsyringe';
import AppError from '@shared/errors/AppError';
import Client from '../infra/typeorm/entities/Client';
import IClientsRepository from '../repositories/IClientsRepository';

interface IRequest {
  name: string;
  email: string;
  password: string;
  phone: string;
}

@injectable()
class CreateClientService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,
  ) {}

  public async execute({
    name,
    email,
    password,
    phone,
  }: IRequest): Promise<Client> {
    const existing = await this.clientsRepository.findByEmail(email);
    const hashedPassword = await hash(password, 8);

    // Cadastrado antes pelo barbeiro (sem senha): criar a conta completa o
    // cadastro e mantém o histórico de agendamentos
    if (existing && !existing.password) {
      Object.assign(existing, { name, phone, password: hashedPassword });

      return this.clientsRepository.save(existing);
    }

    if (existing) {
      throw new AppError('Este e-mail já está em uso.');
    }

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
