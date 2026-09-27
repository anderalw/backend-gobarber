import { injectable, inject } from 'tsyringe';
import { getHours, isAfter } from 'date-fns';

import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';

interface IRequest {
  provider_id: string;
  day: number;
  month: number;
  year: number;
}

type IResponse = Array<{
  hour: number;
  available: boolean;
}>;

@injectable()
class ListProviderDayAvailabilityService {
  constructor(
     // @ts-ignore
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    // 1. Injetamos o novo repositório de horários
     // @ts-ignore
    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,
  ) {}

  public async execute({
    provider_id,
    year,
    month,
    day,
  }: IRequest): Promise<IResponse> {
    const appointments = await this.appointmentsRepository.findAllInDayFromProvider(
      {
        provider_id,
        year,
        month,
        day,
      },
    );

    // 2. Determinar o dia da semana (0 = Domingo, 1 = Segunda, ... 6 = Sábado)
    const requestedDate = new Date(year, month - 1, day);
    const dayOfWeek = requestedDate.getDay();

    // 3. Procurar os horários de trabalho deste barbeiro
    const schedules = await this.providerSchedulesRepository.findByProviderId(provider_id);
    
    // 4. Encontrar a regra para o dia da semana selecionado
    const scheduleForDay = schedules.find(schedule => schedule.day_of_week === dayOfWeek);

    // Se o barbeiro não tiver horário para este dia, devolvemos uma lista vazia
    if (!scheduleForDay) {
      return [];
    }

    // 5. Extrair a hora inicial e final (ex: de '09:00' retira o 9)
    const startHour = Number(scheduleForDay.start_time.split(':')[0]);
    const endHour = Number(scheduleForDay.end_time.split(':')[0]);

    // 6. Criar as horas dinamicamente (ex: [9, 10, 11])
    const eachHourArray = Array.from(
      { length: endHour - startHour },
      (_, index) => index + startHour,
    );

    const currentDate = new Date(Date.now());

    // 7. Validar se a hora já passou ou se já existe agendamento
    const availability = eachHourArray.map(hour => {
      const hasAppointmentInHour = appointments.find(
        appointment => getHours(appointment.date) === hour,
      );

      const compareDate = new Date(year, month - 1, day, hour);

      return {
        hour,
        available: !hasAppointmentInHour && isAfter(compareDate, currentDate),
      };
    });

    return availability;
  }
}

export default ListProviderDayAvailabilityService;