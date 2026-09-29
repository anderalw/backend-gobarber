import { injectable, inject } from 'tsyringe';
import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfDay,
  isBefore,
  max,
  min,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';

import AppError from '@shared/errors/AppError';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import ProviderSchedule from '@modules/users/infra/typeorm/entities/ProviderSchedule';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';
import IBlockPeriod from '../dtos/IBlockPeriod';
import workWindow from '../utils/workWindow';
import { receivedCents } from '../utils/payment';
import { MAX_REPORT_DAYS } from './RevenueReportService';

interface IRange {
  start: string;
  end: string;
}

interface IPeriodNumbers {
  // Todos os agendamentos do período, inclusive cancelados
  total: number;
  completed: number;
  no_show: number;
  canceled: number;
  revenue_cents: number;
  average_ticket_cents: number;
  // Faltas ÷ (atendidos + faltas); null sem nenhum dos dois
  no_show_rate: number | null;
  // Cancelados ÷ total; null sem agendamentos
  cancel_rate: number | null;
  // Clientes atendidos no período e, desses, os que vieram pela 1ª vez
  active_clients: number;
  new_clients: number;
}

interface IOccupancy {
  // Minutos de atendimento marcados ÷ minutos de expediente (sem bloqueios)
  booked_minutes: number;
  available_minutes: number;
  rate: number | null;
}

interface IResponse {
  current: IPeriodNumbers & { occupancy: IOccupancy };
  // Período anterior do mesmo tamanho, para comparar
  previous: IPeriodNumbers & { occupancy: IOccupancy };
  providers: Array<IOccupancy & { id: string; name: string }>;
  services: Array<{
    id: string | null;
    name: string;
    // Marcados (sem cancelados) e o que renderam os concluídos
    count: number;
    revenue_cents: number;
  }>;
  // Agendamentos (sem cancelados) por dia da semana e hora de início
  heatmap: {
    hours: number[];
    // Um item por dia da semana (0 = domingo), uma contagem por hora
    days: number[][];
  };
}

interface ILostClient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  last_visit: Date;
  visits: number;
  total_cents: number;
  // Dias desde a última visita
  days_away: number;
}

// Intervalos [início, fim] sem sobreposição, somados em minutos
function mergedMinutes(ranges: Array<[Date, Date]>): number {
  const sorted = ranges
    .filter(([from, to]) => isBefore(from, to))
    .sort((a, b) => a[0].getTime() - b[0].getTime());

  let total = 0;
  let current: [Date, Date] | null = null;

  sorted.forEach(([from, to]) => {
    if (current && !isBefore(current[1], from)) {
      current[1] = max([current[1], to]);
      return;
    }

    if (current) total += differenceInMinutes(current[1], current[0]);
    current = [from, to];
  });

  if (current) {
    const [from, to] = current as [Date, Date];
    total += differenceInMinutes(to, from);
  }

  return total;
}

const rate = (part: number, whole: number): number | null =>
  whole > 0 ? part / whole : null;

// Indicadores da barbearia num período: ocupação da agenda, faltas,
// cancelamentos, serviços mais pedidos, horários mais cheios e clientes
// novos, sempre comparando com o período anterior de mesmo tamanho
@injectable()
class InsightsService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,

    @inject('TimeBlocksRepository')
    private timeBlocksRepository: ITimeBlocksRepository,

    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,
  ) {}

  public async execute({ start, end }: IRange): Promise<IResponse> {
    const first = startOfDay(parseISO(start));
    const last = startOfDay(parseISO(end));

    if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) {
      throw new AppError('Informe um período válido.');
    }

    if (isBefore(last, first)) {
      throw new AppError('O fim do período precisa ser depois do início.');
    }

    const dayCount = differenceInCalendarDays(last, first) + 1;

    if (dayCount > MAX_REPORT_DAYS) {
      throw new AppError(
        `O período pode ter no máximo ${MAX_REPORT_DAYS} dias.`,
      );
    }

    const previousFirst = subDays(first, dayCount);
    const previousLast = subDays(first, 1);

    const [appointments, previousAppointments, users, schedules, visits] =
      await Promise.all([
        this.appointmentsRepository.findAllInPeriod(first, endOfDay(last)),
        this.appointmentsRepository.findAllInPeriod(
          previousFirst,
          endOfDay(previousLast),
        ),
        this.usersRepository.findAllProviders({ include_inactive: true }),
        Promise.all(
          [0, 1, 2, 3, 4, 5, 6].map(day =>
            this.providerSchedulesRepository.findByDayOfWeek(day),
          ),
        ).then(lists => lists.flat()),
        this.appointmentsRepository.clientVisits(new Date(Date.now())),
      ]);

    const [blocks, previousBlocks] = await Promise.all([
      this.timeBlocksRepository.findInRange({
        start: first,
        end: endOfDay(last),
      }),
      this.timeBlocksRepository.findInRange({
        start: previousFirst,
        end: endOfDay(previousLast),
      }),
    ]);

    const firstVisits = new Map(
      visits.map(item => [item.client_id, item.first_visit]),
    );

    const numbers = (
      list: Appointment[],
      from: Date,
      to: Date,
    ): IPeriodNumbers => {
      const completed = list.filter(
        item => !item.canceled_at && item.attendance === 'completed',
      );
      const noShow = list.filter(
        item => !item.canceled_at && item.attendance === 'no_show',
      ).length;
      const canceled = list.filter(item => item.canceled_at).length;
      const revenue = completed.reduce(
        (sum, item) => sum + receivedCents(item),
        0,
      );
      const active = new Set(
        completed.flatMap(item => (item.client_id ? [item.client_id] : [])),
      );
      const newClients = Array.from(active).filter(id => {
        const firstVisit = firstVisits.get(id);

        return (
          !!firstVisit &&
          !isBefore(firstVisit, from) &&
          !isBefore(endOfDay(to), firstVisit)
        );
      }).length;

      return {
        total: list.length,
        completed: completed.length,
        no_show: noShow,
        canceled,
        revenue_cents: revenue,
        average_ticket_cents:
          completed.length > 0 ? Math.round(revenue / completed.length) : 0,
        no_show_rate: rate(noShow, completed.length + noShow),
        cancel_rate: rate(canceled, list.length),
        active_clients: active.size,
        new_clients: newClients,
      };
    };

    const currentOccupancy = this.occupancy(
      appointments,
      schedules,
      blocks,
      users,
      first,
      dayCount,
    );
    const previousOccupancy = this.occupancy(
      previousAppointments,
      schedules,
      previousBlocks,
      users,
      previousFirst,
      dayCount,
    );

    return {
      current: {
        ...numbers(appointments, first, last),
        occupancy: currentOccupancy.total,
      },
      previous: {
        ...numbers(previousAppointments, previousFirst, previousLast),
        occupancy: previousOccupancy.total,
      },
      providers: currentOccupancy.providers,
      services: this.services(appointments),
      heatmap: this.heatmap(appointments, schedules),
    };
  }

  // Clientes que já vieram e não voltam há days dias (sem horário marcado),
  // dos que mais vieram para os que menos vieram
  public async lostClients(days: number): Promise<ILostClient[]> {
    if (!Number.isInteger(days) || days < 7 || days > 365) {
      throw new AppError('Escolha de 7 a 365 dias.');
    }

    const now = new Date(Date.now());
    const limit = subDays(now, days);

    const lost = (await this.appointmentsRepository.clientVisits(now))
      .filter(
        item =>
          item.visits > 0 &&
          item.last_visit &&
          isBefore(item.last_visit, limit) &&
          !item.has_upcoming,
      )
      .sort(
        (a, b) =>
          b.visits - a.visits ||
          (b.last_visit as Date).getTime() - (a.last_visit as Date).getTime(),
      )
      .slice(0, 100);

    const clients = await this.clientsRepository.findByIds(
      lost.map(item => item.client_id),
    );

    return lost.flatMap(item => {
      const client = clients.find(other => other.id === item.client_id);

      if (!client) return [];

      return [
        {
          id: client.id,
          name: client.name,
          phone: client.phone,
          email: client.email,
          last_visit: item.last_visit as Date,
          visits: item.visits,
          total_cents: item.total_cents,
          days_away: differenceInCalendarDays(now, item.last_visit as Date),
        },
      ];
    });
  }

  // Minutos marcados ÷ minutos de expediente, por barbeiro e no total
  private occupancy(
    appointments: Appointment[],
    schedules: ProviderSchedule[],
    blocks: IBlockPeriod[],
    users: Array<{ id: string; name: string; active: boolean }>,
    first: Date,
    dayCount: number,
  ): {
    total: IOccupancy;
    providers: Array<IOccupancy & { id: string; name: string }>;
  } {
    const active = appointments.filter(item => !item.canceled_at);

    const providers = users
      .map(user => {
        let available = 0;

        for (let index = 0; index < dayCount; index += 1) {
          const day = addDays(first, index);
          const schedule = schedules.find(
            item =>
              item.provider_id === user.id && item.day_of_week === day.getDay(),
          );

          if (schedule) {
            const { workStart, workEnd } = workWindow(day, schedule);
            const blocked = mergedMinutes(
              blocks
                .filter(block => block.provider_id === user.id)
                .map(
                  block =>
                    [
                      max([block.start_date, workStart]),
                      min([block.end_date, workEnd]),
                    ] as [Date, Date],
                ),
            );

            available += Math.max(
              0,
              differenceInMinutes(workEnd, workStart) - blocked,
            );
          }
        }

        const booked = active
          .filter(item => item.provider_id === user.id)
          .reduce(
            (sum, item) => sum + differenceInMinutes(item.end_date, item.date),
            0,
          );

        return {
          id: user.id,
          name: user.name,
          active: user.active,
          booked_minutes: booked,
          available_minutes: available,
          rate: available > 0 ? Math.min(1, booked / available) : null,
        };
      })
      // Desativados só aparecem se atenderam no período
      .filter(item => item.available_minutes > 0 || item.booked_minutes > 0)
      .sort(
        (a, b) =>
          (b.rate ?? -1) - (a.rate ?? -1) || a.name.localeCompare(b.name),
      );

    const booked = providers.reduce(
      (sum, item) => sum + item.booked_minutes,
      0,
    );
    const available = providers.reduce(
      (sum, item) => sum + item.available_minutes,
      0,
    );

    return {
      total: {
        booked_minutes: booked,
        available_minutes: available,
        rate: available > 0 ? Math.min(1, booked / available) : null,
      },
      providers: providers.map(({ active: _active, ...item }) => item),
    };
  }

  private services(appointments: Appointment[]): IResponse['services'] {
    const services = new Map<string, IResponse['services'][number]>();

    appointments
      .filter(item => !item.canceled_at)
      .forEach(item => {
        const key = item.service_id || 'none';
        const service = services.get(key) || {
          id: item.service_id,
          name: item.service?.name || 'Serviço não informado',
          count: 0,
          revenue_cents: 0,
        };

        service.count += 1;
        if (item.attendance === 'completed') {
          service.revenue_cents += receivedCents(item);
        }

        services.set(key, service);
      });

    return Array.from(services.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8);
  }

  private heatmap(
    appointments: Appointment[],
    schedules: ProviderSchedule[],
  ): IResponse['heatmap'] {
    const active = appointments.filter(item => !item.canceled_at);
    const toHour = (time: string): number => Number(time.split(':')[0]);

    // Do começo do expediente mais cedo ao fim do mais tarde
    const starts = [
      ...schedules.map(item => toHour(item.start_time)),
      ...active.map(item => item.date.getHours()),
    ];
    const ends = [
      ...schedules.map(item => toHour(item.end_time) - 1),
      ...active.map(item => item.date.getHours()),
    ];
    const from = starts.length ? Math.min(...starts) : 8;
    const to = ends.length ? Math.max(...ends) : 18;
    const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);

    const days = [0, 1, 2, 3, 4, 5, 6].map(() => hours.map(() => 0));

    active.forEach(item => {
      const column = item.date.getHours() - from;

      if (column >= 0 && column < hours.length) {
        days[item.date.getDay()][column] += 1;
      }
    });

    return { hours, days };
  }
}

export default InsightsService;
