import { injectable, inject } from 'tsyringe';
import { endOfDay, startOfDay } from 'date-fns';

import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import {
  Attendance,
  PaymentMethod,
} from '../infra/typeorm/entities/Appointment';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';
import IBlockPeriod from '../dtos/IBlockPeriod';
import IAppointmentSeriesRepository from '../repositories/IAppointmentSeriesRepository';
import NoShowPolicyService, {
  hasNoShowAlert,
  RECENT_APPOINTMENTS,
} from './NoShowPolicyService';

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
  // Clube: incluso no plano / preço normal quando houve benefício
  membership_id: string | null;
  list_price_cents: number | null;
  // Pacote de sessões que cobre o horário
  package_id: string | null;
  // Sinal pedido e o recebimento (null = ainda não)
  deposit_cents: number | null;
  deposit_paid_at: Date | null;
  deposit_method: PaymentMethod | null;
  // Concluído ou falta; null = ainda não registrado
  attendance: Attendance | null;
  // Pagamento do atendimento concluído (null = não informado)
  payment_method: PaymentMethod | null;
  paid_cents: number | null;
  // Quando o cliente confirmou pelo link do e-mail, ou a barbearia registrou
  // (null = não confirmou)
  confirmed_at: Date | null;
  // Barbeiro que registrou a confirmação; null = o cliente, pelo link
  confirmed_by: { id: string; name: string } | null;
  // Cliente fixo: repetição e quantos horários faltam, contando este
  series: { id: string; interval_weeks: number; remaining: number } | null;
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
    notes: string | null;
    // Atendimentos concluídos, faltas e última visita
    completed: number;
    no_shows: number;
    last_visit: Date | null;
    // Faltas recentes acima do limite da política de faltas
    no_show_alert: boolean;
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

    @inject(NoShowPolicyService)
    private noShowPolicy: NoShowPolicyService,

    @inject('AppointmentSeriesRepository')
    private seriesRepository: IAppointmentSeriesRepository,
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

    const now = new Date(Date.now());
    const clientIds = Array.from(
      new Set(
        appointments.flatMap(appointment =>
          appointment.client_id ? [appointment.client_id] : [],
        ),
      ),
    );
    const inSeries = appointments.filter(appointment => appointment.series_id);
    const [summaries, policy, seriesList, remaining] = await Promise.all([
      this.appointmentsRepository.summarizeByClients(
        clientIds,
        now,
        RECENT_APPOINTMENTS,
      ),
      this.noShowPolicy.get(),
      this.seriesRepository.findByIds(
        Array.from(new Set(inSeries.map(item => item.series_id as string))),
      ),
      Promise.all(
        inSeries.map(async item => ({
          id: item.id,
          count: (
            await this.appointmentsRepository.findFollowingInSeries(
              item.series_id as string,
              item.date,
            )
          ).length,
        })),
      ),
    ]);

    const seriesOf = (appointment: {
      id: string;
      series_id: string | null;
    }): IAgendaAppointment['series'] => {
      const series = seriesList.find(item => item.id === appointment.series_id);

      if (!series) return null;

      return {
        id: series.id,
        interval_weeks: series.interval_weeks,
        remaining:
          remaining.find(item => item.id === appointment.id)?.count || 1,
      };
    };

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

    const clientWithHistory = (client: {
      id: string;
      name: string;
      email: string | null;
      phone: string;
      notes: string | null;
    }): NonNullable<IAgendaAppointment['client']> => {
      const summary = summaries.find(item => item.client_id === client.id);

      return {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        notes: client.notes ?? null,
        completed: summary?.completed || 0,
        no_shows: summary?.no_shows || 0,
        last_visit: summary?.last_visit || null,
        no_show_alert: hasNoShowAlert(summary?.recent_no_shows || 0, policy),
      };
    };

    const confirmedBy = (
      id: string | null,
    ): IAgendaAppointment['confirmed_by'] => {
      const user = id ? users.find(item => item.id === id) : undefined;

      return user ? { id: user.id, name: user.name } : null;
    };

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
        membership_id: appointment.membership_id,
        list_price_cents: appointment.list_price_cents,
        package_id: appointment.package_id,
        deposit_cents: appointment.deposit_cents,
        deposit_paid_at: appointment.deposit_paid_at,
        deposit_method: appointment.deposit_method,
        attendance: appointment.attendance,
        payment_method: appointment.payment_method,
        paid_cents: appointment.paid_cents,
        confirmed_at: appointment.confirmed_at,
        confirmed_by: confirmedBy(appointment.confirmed_by),
        series: seriesOf(appointment),
        confirmation_requested_at: appointment.confirmation_requested_at,
        created_at: appointment.created_at,
        client: appointment.client
          ? clientWithHistory(appointment.client)
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
