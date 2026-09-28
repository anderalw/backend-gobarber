import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import checkAvailableSlot from '../utils/checkAvailableSlot';

interface IRequest {
  provider_id: string;
  service_id: string;
  date: Date;
}

type IResponse =
  | { available: true; end: Date }
  | { available: false; reason: string };

// Diz se um serviço cabe num horário exato, com as mesmas regras de quando o
// agendamento é gravado. A lista de horários livres é encadeada a partir do
// início do expediente, então um horário válido (ex.: clicado na agenda) pode
// não aparecer nela
@injectable()
class CheckSlotService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,

    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,

    @inject(AgendaSettingsService)
    private agendaSettings: AgendaSettingsService,

    @inject('UsersRepository')
    private usersRepository: IUsersRepository,
  ) {}

  public async execute({
    provider_id,
    service_id,
    date,
  }: IRequest): Promise<IResponse> {
    const service = await this.servicesRepository.findById(service_id);

    if (!service || !service.active) {
      throw new AppError('Serviço não encontrado.');
    }

    try {
      const { end } = await checkAvailableSlot(
        {
          usersRepository: this.usersRepository,
          appointmentsRepository: this.appointmentsRepository,
          providerSchedulesRepository: this.providerSchedulesRepository,
          agendaSettings: this.agendaSettings,
        },
        { provider_id, start: date, durationMinutes: service.duration_minutes },
      );

      return { available: true, end };
    } catch (err) {
      if (err instanceof AppError) {
        return { available: false, reason: err.message };
      }

      throw err;
    }
  }
}

export default CheckSlotService;
