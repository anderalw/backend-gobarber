import { injectable, inject } from 'tsyringe';
import { endOfDay, startOfDay } from 'date-fns';

import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import { Attendance } from '../infra/typeorm/entities/Appointment';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';
import IBlockPeriod from '../dtos/IBlockPeriod';

interface IRequest {
  day: number;
  month: number;
  year: number;
}

interface IAgendaProvider {
  id: string;
  name: string;
  avatar_url: string | null;
  // false: desativado, aparece só porque tem atendimentos neste dia
  active: boolean;
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
  // Concluído ou falta; null = ainda não registrado
  attendance: Attendance | null;
  // Quando o cliente confirmou pelo link do e-mail (null = não confirmou)
  confirmed_at: Date | null;
  // Quando o pedido de confirmação foi enviado (null = ainda não foi)
  confirmation_requested_at: Date | null;
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

interface IAgendaBlock {
  id: string;
  provider_id: string;
  // Podem começar antes ou terminar depois do dia (ex: férias)
  start_date: Date;
  end_date: Date;
  reason: string | null;
  // Bloqueio que se repete: a regra; null no avulso
  recurrence: IBlockPeriod['recurrence'];
}

interface IResponse {
  providers: IAgendaProvider[];
  appointments: IAgendaAppointment[];
  // Horários bloqueados no dia
  blocks: IAgendaBlock[];
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

    @inject('TimeBlocksRepository')
    private timeBlocksRepository: ITimeBlocksRepository,
  ) {}

  public async execute({ day, month, year }: IRequest): Promise<IResponse> {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();

    const [users, schedules, appointments, blocks] = await Promise.all([
      this.usersRepository.findAllProviders({ include_inactive: true }),
      this.providerSchedulesRepository.findByDayOfWeek(dayOfWeek),
      this.appointmentsRepository.findAllInDay({ day, month, year }),
      this.timeBlocksRepository.findInRange({
        start: startOfDay(date),
        end: endOfDay(date),
      }),
    ]);

    const providers = users
      .filter(
        user =>
          user.active ||
          appointments.some(appointment => appointment.provider_id === user.id),
      )
      .map(user => {
        const schedule = schedules.find(item => item.provider_id === user.id);

        return {
          id: user.id,
          name: user.name,
          avatar_url: user.getAvatarUrl(),
          active: user.active,
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
        attendance: appointment.attendance,
        confirmed_at: appointment.confirmed_at,
        confirmation_requested_at: appointment.confirmation_requested_at,
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
      blocks: blocks.map(block => ({
        id: block.id,
        provider_id: block.provider_id,
        start_date: block.start_date,
        end_date: block.end_date,
        reason: block.reason,
        recurrence: block.recurrence,
      })),
    };
  }
}

export default ListDayAgendaService;
