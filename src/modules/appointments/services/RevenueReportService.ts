import { injectable, inject } from 'tsyringe';
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  isBefore,
  parseISO,
  startOfDay,
} from 'date-fns';

import AppError from '@shared/errors/AppError';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import { PaymentTotals } from '../infra/typeorm/entities/CashClosing';
import { receivedCents, totalsByMethod } from '../utils/payment';

interface IRequest {
  // 'yyyy-MM-dd', inclusive
  start: string;
  end: string;
}

interface ICounts {
  // Atendidos: entram no faturamento
  completed: number;
  no_show: number;
  // Horário já começou e ninguém registrou a situação
  pending: number;
  // Ainda não começou
  upcoming: number;
  revenue_cents: number;
}

interface IResponse {
  totals: ICounts & {
    canceled: number;
    // Concluídos + a confirmar + futuros: o que o período pode render
    expected_cents: number;
    // Valor dos horários em que o cliente faltou
    lost_cents: number;
    // Faturado ÷ concluídos (0 sem atendimentos)
    average_ticket_cents: number;
  };
  providers: Array<ICounts & { id: string; name: string }>;
  services: Array<{
    id: string | null;
    name: string;
    completed: number;
    revenue_cents: number;
  }>;
  // Um item por dia do período, para o gráfico
  days: Array<{ date: string; completed: number; revenue_cents: number }>;
  // Recebido em cada forma de pagamento (unknown = não informada)
  methods: PaymentTotals;
}

// Limite de um relatório (um ano)
export const MAX_REPORT_DAYS = 366;

const emptyCounts = (): ICounts => ({
  completed: 0,
  no_show: 0,
  pending: 0,
  upcoming: 0,
  revenue_cents: 0,
});

// Onde o agendamento entra: concluído, falta, a confirmar ou futuro
function situationOf(
  appointment: Appointment,
  now: Date,
): 'completed' | 'no_show' | 'pending' | 'upcoming' {
  if (appointment.attendance === 'completed') return 'completed';
  if (appointment.attendance === 'no_show') return 'no_show';

  return isBefore(now, appointment.date) ? 'upcoming' : 'pending';
}

// Faturamento de um período: o que foi atendido (e quanto rendeu), faltas,
// atendimentos a confirmar e o que ainda vai acontecer, no total, por
// barbeiro, por serviço e por dia. O valor é o do momento da marcação
@injectable()
class RevenueReportService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,
  ) {}

  public async execute({ start, end }: IRequest): Promise<IResponse> {
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

    const appointments = await this.appointmentsRepository.findAllInPeriod(
      first,
      endOfDay(last),
    );
    const now = new Date(Date.now());

    const totals = { ...emptyCounts(), canceled: 0, expected_cents: 0 };
    let lostCents = 0;
    const providers = new Map<string, ICounts & { id: string; name: string }>();
    const services = new Map<
      string,
      {
        id: string | null;
        name: string;
        completed: number;
        revenue_cents: number;
      }
    >();
    const days = new Map(
      Array.from({ length: dayCount }, (_, index) => {
        const date = format(addDays(first, index), 'yyyy-MM-dd');

        return [date, { date, completed: 0, revenue_cents: 0 }];
      }),
    );

    appointments.forEach(appointment => {
      if (appointment.canceled_at) {
        totals.canceled += 1;
        return;
      }

      const situation = situationOf(appointment, now);
      // Atendido: o que foi recebido; nos outros casos, o preço marcado
      const price =
        situation === 'completed'
          ? receivedCents(appointment)
          : appointment.price_cents || 0;

      const provider = providers.get(appointment.provider_id) || {
        ...emptyCounts(),
        id: appointment.provider_id,
        name: appointment.provider?.name || 'Barbeiro removido',
      };
      providers.set(appointment.provider_id, provider);

      totals[situation] += 1;
      provider[situation] += 1;

      if (situation === 'no_show') {
        lostCents += price;
        return;
      }

      totals.expected_cents += price;

      if (situation !== 'completed') return;

      totals.revenue_cents += price;
      provider.revenue_cents += price;

      const serviceKey = appointment.service_id || 'none';
      const service = services.get(serviceKey) || {
        id: appointment.service_id,
        name: appointment.service?.name || 'Serviço não informado',
        completed: 0,
        revenue_cents: 0,
      };
      service.completed += 1;
      service.revenue_cents += price;
      services.set(serviceKey, service);

      const day = days.get(format(appointment.date, 'yyyy-MM-dd'));
      if (day) {
        day.completed += 1;
        day.revenue_cents += price;
      }
    });

    const byRevenue = <T extends { revenue_cents: number; name: string }>(
      a: T,
      b: T,
    ): number =>
      b.revenue_cents - a.revenue_cents || a.name.localeCompare(b.name);

    return {
      totals: {
        ...totals,
        lost_cents: lostCents,
        average_ticket_cents:
          totals.completed > 0
            ? Math.round(totals.revenue_cents / totals.completed)
            : 0,
      },
      providers: Array.from(providers.values()).sort(byRevenue),
      services: Array.from(services.values()).sort(byRevenue),
      days: Array.from(days.values()),
      methods: totalsByMethod(
        appointments.filter(
          item => !item.canceled_at && item.attendance === 'completed',
        ),
      ),
    };
  }
}

export default RevenueReportService;
