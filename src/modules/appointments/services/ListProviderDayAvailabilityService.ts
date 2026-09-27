import { injectable, inject } from 'tsyringe';
import { format } from 'date-fns';

import AppError from '@shared/errors/AppError';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import computeAvailableSlots from '../utils/computeAvailableSlots';
import workWindow from '../utils/workWindow';

interface IRequest {
  provider_id: string;
  service_id: string;
  day: number;
  month: number;
  year: number;
}

// Só os horários livres, no formato 'HH:mm'
type IResponse = Array<{ time: string }>;

@injectable()
class ListProviderDayAvailabilityService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,

    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,

    @inject(AgendaSettingsService)
    private agendaSettings: AgendaSettingsService,
  ) {}

  public async execute({
    provider_id,
    service_id,
    year,
    month,
    day,
  }: IRequest): Promise<IResponse> {
    const service = await this.servicesRepository.findById(service_id);

    if (!service || !service.active) {
      throw new AppError('Serviço não encontrado.', 404);
    }

    const date = new Date(year, month - 1, day);

    const schedules = await this.providerSchedulesRepository.findByProviderId(
      provider_id,
    );
    const schedule = schedules.find(item => item.day_of_week === date.getDay());

    // Folga neste dia da semana
    if (!schedule) {
      return [];
    }

    const [appointments, { buffer_minutes }] = await Promise.all([
      this.appointmentsRepository.findAllInDayFromProvider({
        provider_id,
        year,
        month,
        day,
      }),
      this.agendaSettings.get(),
    ]);

    const slots = computeAvailableSlots({
      ...workWindow(date, schedule),
      durationMinutes: service.duration_minutes,
      bufferMinutes: buffer_minutes,
      busy: appointments.map(appointment => ({
        start: appointment.date,
        end: appointment.blocked_until,
      })),
      now: new Date(Date.now()),
    });

    return slots.map(slot => ({ time: format(slot, 'HH:mm') }));
  }
}

export default ListProviderDayAvailabilityService;
