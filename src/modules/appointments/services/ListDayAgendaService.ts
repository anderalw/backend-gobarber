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
  // Fim do atendimento (início + duração do serviço)
  end_date: Date;
  // Fim do intervalo depois do atendimento (igual a end_date sem intervalo)
  blocked_until: Date;
  provider_id: string;
  // null em agendamentos anteriores ao cadastro de serviços
  service: { id: string; name: string } | null;
  // Valor cobrado no momento da marcação, em centavos
  price_cents: number | null;
  // Quando o cliente fez a marcação
  created_at: Date;
  // email null: cliente cadastrado pelo barbeiro sem e-mail
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
  } | null;
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
        end_date: appointment.end_date,
        blocked_until: appointment.blocked_until,
        provider_id: appointment.provider_id,
        service: appointment.service
          ? { id: appointment.service.id, name: appointment.service.name }
          : null,
        price_cents: appointment.price_cents,
        created_at: appointment.created_at,
        client: appointment.client
          ? {
              id: appointment.client.id,
              name: appointment.client.name,
              email: appointment.client.email,
              phone: appointment.client.phone,
            }
          : null,
      })),
    };
  }
}

export default ListDayAgendaService;
