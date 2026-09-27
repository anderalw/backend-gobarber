import { injectable, inject } from 'tsyringe';

import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';

interface IRequest {
  day: number;
  month: number;
  year: number;
}

interface IAgendaProvider {
  id: string;
  name: string;
  avatar_url: string | null;
  // null = o barbeiro não trabalha neste dia da semana
  schedule: { start_time: string; end_time: string } | null;
}

interface IAgendaAppointment {
  id: string;
  date: Date;
  provider_id: string;
  client: { id: string; name: string; phone: string } | null;
}

interface IResponse {
  providers: IAgendaProvider[];
  appointments: IAgendaAppointment[];
}

// Agenda compartilhada da barbearia: todos os barbeiros e todos os
// agendamentos de um dia, para a visão em colunas do dashboard
@injectable()
class ListDayAgendaService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,
  ) {}

  public async execute({ day, month, year }: IRequest): Promise<IResponse> {
    const dayOfWeek = new Date(year, month - 1, day).getDay();

    const [users, schedules, appointments] = await Promise.all([
      this.usersRepository.findAllProviders({}),
      this.providerSchedulesRepository.findByDayOfWeek(dayOfWeek),
      this.appointmentsRepository.findAllInDay({ day, month, year }),
    ]);

    const providers = users
      .map(user => {
        const schedule = schedules.find(item => item.provider_id === user.id);

        return {
          id: user.id,
          name: user.name,
          avatar_url: user.getAvatarUrl(),
          schedule: schedule
            ? { start_time: schedule.start_time, end_time: schedule.end_time }
            : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      providers,
      appointments: appointments.map(appointment => ({
        id: appointment.id,
        date: appointment.date,
        provider_id: appointment.provider_id,
        client: appointment.client
          ? {
              id: appointment.client.id,
              name: appointment.client.name,
              phone: appointment.client.phone,
            }
          : null,
      })),
    };
  }
}

export default ListDayAgendaService;
