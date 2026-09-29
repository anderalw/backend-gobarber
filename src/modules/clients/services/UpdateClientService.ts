import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import Client from '../infra/typeorm/entities/Client';
import IClientsRepository from '../repositories/IClientsRepository';

interface IRequest {
  client_id: string;
  name: string;
  phone: string;
  // Vazio ou null remove (só para quem não tem conta no site)
  email?: string | null;
  notes?: string | null;
}

// Barbearia corrigindo os dados do cliente ou anotando observações
@injectable()
class UpdateClientService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,
  ) {}

  public async execute({
    client_id,
    name,
    phone,
    email,
    notes,
  }: IRequest): Promise<Client> {
    const client = await this.clientsRepository.findById(client_id);

    if (!client) {
      throw new AppError('Cliente não encontrado.', 404);
    }

    // Sem mudar maiúsculas: o login do site compara o e-mail como foi salvo
    const newEmail = email && email.trim() ? email.trim() : null;

    // O e-mail é o login de quem tem conta no site
    if (!newEmail && client.password) {
      throw new AppError(
        'Este cliente tem conta no site e entra com o e-mail; ele não pode ficar em branco.',
      );
    }

    if (newEmail && newEmail !== client.email) {
      const other = await this.clientsRepository.findByEmail(newEmail);

      if (other && other.id !== client.id) {
        throw new AppError('Este e-mail já está em uso por outro cliente.');
      }
    }

    client.name = name.trim();
    client.phone = phone.trim();
    client.email = newEmail;
    client.notes = notes && notes.trim() ? notes.trim() : null;

    return this.clientsRepository.save(client);
  }
}

export default UpdateClientService;
