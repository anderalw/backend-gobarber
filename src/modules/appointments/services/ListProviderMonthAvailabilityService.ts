import { injectable, inject } from 'tsyringe';
import { getDaysInMonth, isSameDay } from 'date-fns';

import AppError from '@shared/errors/AppError';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import computeAvailableSlots from '../utils/computeAvailableSlots';
import workWindow from '../utils/workWindow';

interface IRequest {
  provider_id: string;
  // Sem serviço, considera um atendimento de 1 hora
  service_id?: string;
  month: number;
  year: number;
}

type IResponse = Array<{
  day: number;
  available: boolean;
}>;

const DEFAULT_DURATION_MINUTES = 60;

@injectable()
class ListProviderMonthAvailabilityService {
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
  }: IRequest): Promise<IResponse> {
    let durationMinutes = DEFAULT_DURATION_MINUTES;

    if (service_id) {
      const service = await this.servicesRepository.findById(service_id);

      if (!service || !service.active) {
        throw new AppError('Serviço não encontrado.', 404);
      }

      durationMinutes = service.duration_minutes;
    }

    const [appointments, schedules, { buffer_minutes }] = await Promise.all([
      this.appointmentsRepository.findAllInMonthFromProvider({
        provider_id,
        year,
        month,
      }),
      this.providerSchedulesRepository.findByProviderId(provider_id),
      this.agendaSettings.get(),
    ]);

    const now = new Date(Date.now());

    return Array.from(
      { length: getDaysInMonth(new Date(year, month - 1)) },
      (_, index) => {
        const day = index + 1;
        const date = new Date(year, month - 1, day);
        const schedule = schedules.find(
          item => item.day_of_week === date.getDay(),
        );

        if (!schedule) {
          return { day, available: false };
        }

        const slots = computeAvailableSlots({
          ...workWindow(date, schedule),
          durationMinutes,
          bufferMinutes: buffer_minutes,
          busy: appointments
            .filter(appointment => isSameDay(appointment.date, date))
            .map(appointment => ({
              start: appointment.date,
              end: appointment.blocked_until,
            })),
          now,
        });

        return { day, available: slots.length > 0 };
      },
    );
  }
}

export default ListProviderMonthAvailabilityService;
