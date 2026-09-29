import { injectable, inject } from 'tsyringe';
import { differenceInMinutes, endOfDay, format, startOfDay } from 'date-fns';

import AppError from '@shared/errors/AppError';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';
import computeAvailableSlots from '../utils/computeAvailableSlots';
import blocksAsBusy from '../utils/blocksAsBusy';
import workWindow from '../utils/workWindow';
import { IRequester } from '../utils/ensureCanChangeAppointment';

interface IRequest {
  provider_id: string;
  // Para agendar: a duração vem do serviço
  service_id?: string;
  // Para remarcar: a duração vem do agendamento, que não conta como ocupado
  appointment_id?: string;
  // Quem pede (o cliente só pode remarcar os próprios agendamentos)
  requester?: IRequester;
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

    @inject('TimeBlocksRepository')
    private timeBlocksRepository: ITimeBlocksRepository,
  ) {}

  public async execute({
    provider_id,
    service_id,
    appointment_id,
    requester,
    year,
    month,
    day,
  }: IRequest): Promise<IResponse> {
    const durationMinutes = await this.durationFor(
      service_id,
      appointment_id,
      requester,
    );

    const date = new Date(year, month - 1, day);

    const schedules = await this.providerSchedulesRepository.findByProviderId(
      provider_id,
    );
    const schedule = schedules.find(item => item.day_of_week === date.getDay());

    // Folga neste dia da semana
    if (!schedule) {
      return [];
    }

    const [appointments, blocks, { buffer_minutes }] = await Promise.all([
      this.appointmentsRepository.findAllInDayFromProvider({
        provider_id,
        year,
        month,
        day,
      }),
      this.timeBlocksRepository.findInRange({
        provider_id,
        start: startOfDay(date),
        end: endOfDay(date),
      }),
      this.agendaSettings.get(),
    ]);

    const slots = computeAvailableSlots({
      ...workWindow(date, schedule),
      durationMinutes,
      bufferMinutes: buffer_minutes,
      busy: [
        ...appointments
          .filter(appointment => appointment.id !== appointment_id)
          .map(appointment => ({
            start: appointment.date,
            end: appointment.blocked_until,
          })),
        ...blocksAsBusy(blocks, buffer_minutes),
      ],
      now: new Date(Date.now()),
    });

    return slots.map(slot => ({ time: format(slot, 'HH:mm') }));
  }

  private async durationFor(
    service_id?: string,
    appointment_id?: string,
    requester?: IRequester,
  ): Promise<number> {
    if (appointment_id) {
      const appointment = await this.appointmentsRepository.findById(
        appointment_id,
      );

      if (
        !appointment ||
        appointment.canceled_at ||
        (requester?.role === 'client' && appointment.client_id !== requester.id)
      ) {
        throw new AppError('Agendamento não encontrado.', 404);
      }

      return differenceInMinutes(appointment.end_date, appointment.date);
    }

    const service = service_id
      ? await this.servicesRepository.findById(service_id)
      : undefined;

    if (!service || !service.active) {
      throw new AppError('Serviço não encontrado.', 404);
    }

    return service.duration_minutes;
  }
}

export default ListProviderDayAvailabilityService;
