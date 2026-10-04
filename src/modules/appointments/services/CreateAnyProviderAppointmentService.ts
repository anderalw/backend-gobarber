import { injectable, inject } from 'tsyringe';
import { isBefore } from 'date-fns';

import AppError from '@shared/errors/AppError';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import CreateAppointmentsService from './CreateAppointmentsService';

interface IRequest {
  client_id: string;
  service_id: string;
  date: Date;
}

// "Qualquer barbeiro": marca com um barbeiro ativo que esteja livre no
// horário. Entre os livres, fica com quem tem menos atendimentos no dia,
// para dividir o trabalho da equipe
@injectable()
class CreateAnyProviderAppointmentService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,

    @inject(CreateAppointmentsService)
    private createAppointment: CreateAppointmentsService,
  ) {}

  public async execute({
    client_id,
    service_id,
    date,
  }: IRequest): Promise<Appointment> {
    // Erros que valem para qualquer barbeiro saem antes da tentativa
    if (isBefore(date, Date.now())) {
      throw new AppError('Não é possível agendar numa data passada.');
    }

    const service = await this.servicesRepository.findById(service_id);

    if (!service || !service.active) {
      throw new AppError('Serviço não encontrado.');
    }

    const providers = await this.usersRepository.findAllProviders({});

    const workload = await Promise.all(
      providers.map(async provider => ({
        provider,
        count: (
          await this.appointmentsRepository.findAllInDayFromProvider({
            provider_id: provider.id,
            day: date.getDate(),
            month: date.getMonth() + 1,
            year: date.getFullYear(),
          })
        ).length,
      })),
    );

    const candidates = workload.sort(
      (a, b) =>
        a.count - b.count || a.provider.name.localeCompare(b.provider.name),
    );

    // Tenta um por vez: quem não atende no horário (folga, expediente,
    // conflito) é pulado
    const tryFrom = async (index: number): Promise<Appointment> => {
      if (index >= candidates.length) {
        throw new AppError(
          'Nenhum profissional está livre neste horário. Escolha outro horário.',
        );
      }

      try {
        return await this.createAppointment.execute({
          provider_id: candidates[index].provider.id,
          client_id,
          service_id,
          date,
        });
      } catch (err) {
        if (!(err instanceof AppError)) throw err;

        return tryFrom(index + 1);
      }
    };

    return tryFrom(0);
  }
}

export default CreateAnyProviderAppointmentService;
