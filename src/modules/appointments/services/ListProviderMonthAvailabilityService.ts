import { injectable, inject } from 'tsyringe';
import { getDaysInMonth, getDate, isAfter } from 'date-fns';

import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';

interface IRequest {
  provider_id: string;
  month: number;
  year: number;
}

type IResponse = Array<{
  day: number;
  available: boolean;
}>;

@injectable()
class ListProviderMonthAvailabilityService {
  constructor(
    // @ts-ignore
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    // @ts-ignore
    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,
  ) {}

  public async execute({
    provider_id,
    year,
    month,
  }: IRequest): Promise<IResponse> {
    const appointments = await this.appointmentsRepository.findAllInMonthFromProvider(
      {
        provider_id,
        year,
        month,
      },
    );

    const numberOfDaysInMonth = getDaysInMonth(new Date(year, month - 1));

    const eachDayArray = Array.from(
      { length: numberOfDaysInMonth },
      (_, index) => index + 1,
    );

    const schedules = await this.providerSchedulesRepository.findByProviderId(provider_id);

    const currentDate = new Date(Date.now());

    const availability = eachDayArray.map(day => {
      const compareDate = new Date(year, month - 1, day, 23, 59, 59);
      const dayOfWeek = new Date(year, month - 1, day).getDay();

      const scheduleForDay = schedules.find(schedule => schedule.day_of_week === dayOfWeek);

      if (!scheduleForDay) {
        return {
          day,
          available: false,
        };
      }

      const startHour = Number(scheduleForDay.start_time.split(':')[0]);
      const endHour = Number(scheduleForDay.end_time.split(':')[0]);
      
      const totalWorkingHoursInDay = endHour - startHour;

      const appointmentsInDay = appointments.filter(appointment => {
        return getDate(appointment.date) === day;
      });

      return {
        day,
        available:
          isAfter(compareDate, currentDate) &&
          appointmentsInDay.length < totalWorkingHoursInDay,
      };
    });

    return availability;
  }
}

export default ListProviderMonthAvailabilityService;