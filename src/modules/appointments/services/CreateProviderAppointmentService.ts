import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import Appointment from '../infra/typeorm/entities/Appointment';
import CreateAppointmentsService from './CreateAppointmentsService';

interface IRequest {
  // Barbeiro logado que está marcando
  requester_id: string;
  // Barbeiro que vai atender (qualquer um: a agenda é compartilhada)
  provider_id: string;
  service_id: string;
  date: Date;
  client_id: string;
}

// Agendamento feito pelo barbeiro direto na agenda. Segue as mesmas regras do
// cliente (expediente, intervalo, sobreposição), aplicadas por
// CreateAppointmentsService
@injectable()
class CreateProviderAppointmentService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,

    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject(CreateAppointmentsService)
    private createAppointment: CreateAppointmentsService,
  ) {}

  public async execute({
    requester_id,
    provider_id,
    service_id,
    date,
    client_id,
  }: IRequest): Promise<Appointment> {
    const provider = await this.usersRepository.findById(provider_id);

    if (!provider) {
      throw new AppError('Barbeiro não encontrado.');
    }

    if (!(await this.clientsRepository.findById(client_id))) {
      throw new AppError('Cliente não encontrado.');
    }

    return this.createAppointment.execute({
      provider_id,
      service_id,
      date,
      client_id,
      // Quem marca na própria agenda não precisa ser avisado
      notifyProvider: requester_id !== provider_id,
    });
  }
}

export default CreateProviderAppointmentService;
