import { injectable, inject } from 'tsyringe';
import {
  endOfDay,
  format,
  isBefore,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';

import AppError from '@shared/errors/AppError';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IMembershipPaymentsRepository from '@modules/memberships/repositories/IMembershipPaymentsRepository';
import MembershipPayment from '@modules/memberships/infra/typeorm/entities/MembershipPayment';
import Appointment, {
  PaymentMethod,
} from '../infra/typeorm/entities/Appointment';
import { PaymentTotals } from '../infra/typeorm/entities/CashClosing';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import ICashClosingsRepository from '../repositories/ICashClosingsRepository';
import {
  MAX_PAID_CENTS,
  receivedCents,
  totalsByMethod,
  validatePayment,
} from '../utils/payment';

interface ICashItem {
  id: string;
  date: Date;
  client_name: string;
  provider_name: string;
  service_name: string;
  price_cents: number | null;
  paid_cents: number | null;
  received_cents: number;
  payment_method: PaymentMethod | null;
}

// Já começou e ninguém registrou se o cliente foi atendido ou faltou
interface IPendingItem {
  id: string;
  date: Date;
  client_name: string;
  provider_id: string;
  provider_name: string;
  service_name: string;
  price_cents: number | null;
  // Coberto pelo plano do clube (pode fechar como "incluso no plano")
  included: boolean;
}

// Dias anteriores com atendimentos sem registro
interface IPendingDay {
  date: string;
  count: number;
}

// Até quantos dias para trás o caixa avisa de pendências
const PENDING_LOOKBACK_DAYS = 60;

// Mensalidade do clube recebida no dia
interface IMembershipItem {
  id: string;
  paid_at: Date;
  client_name: string;
  plan_name: string;
  amount_cents: number;
  payment_method: PaymentMethod;
}

interface IClosingView {
  opening_cents: number;
  counted_cents: number;
  expected_cash_cents: number;
  // Contado − esperado (negativo: faltou dinheiro)
  difference_cents: number;
  received_cents: number;
  notes: string | null;
  closed_at: Date;
  closed_by: { id: string; name: string } | null;
  // Mudou algo depois de fechar (ex: atendimento registrado depois)
  outdated: boolean;
}

interface IResponse {
  date: string;
  received_cents: number;
  totals: PaymentTotals;
  // Atendimentos concluídos do dia, em ordem
  items: ICashItem[];
  // Mensalidades do clube recebidas no dia (entram nos totais)
  memberships: IMembershipItem[];
  // Já começaram e ninguém registrou se foi atendido
  pending: number;
  pending_items: IPendingItem[];
  // Outros dias (antes deste) com atendimentos sem registro
  pending_days: IPendingDay[];
  no_show: number;
  closing: IClosingView | null;
}

interface ICloseRequest {
  date: string;
  opening_cents: number;
  counted_cents: number;
  notes?: string | null;
  user_id: string;
}

// Caixa do dia: o que foi recebido em cada forma de pagamento e o
// fechamento (fundo de troco + dinheiro recebido = o que deve ter na gaveta)
@injectable()
class CashRegisterService {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('CashClosingsRepository')
    private cashClosingsRepository: ICashClosingsRepository,

    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    // Opcional só para os testes que não envolvem o clube
    @inject('MembershipPaymentsRepository')
    private membershipPaymentsRepository?: IMembershipPaymentsRepository,
  ) {}

  public async show(date: string): Promise<IResponse> {
    const { completed, pending, noShow, payments } = await this.dayAppointments(
      date,
    );
    const { totals, received } = this.sum(completed, payments);

    const closing = await this.cashClosingsRepository.findByDate(date);
    let closingView: IClosingView | null = null;

    if (closing) {
      const user = closing.closed_by
        ? await this.usersRepository.findById(closing.closed_by)
        : undefined;
      const expectedNow = closing.opening_cents + totals.cash.cents;

      closingView = {
        opening_cents: closing.opening_cents,
        counted_cents: closing.counted_cents,
        expected_cash_cents: closing.expected_cash_cents,
        difference_cents: closing.counted_cents - closing.expected_cash_cents,
        received_cents: closing.received_cents,
        notes: closing.notes,
        closed_at: closing.closed_at,
        closed_by: user ? { id: user.id, name: user.name } : null,
        outdated:
          closing.received_cents !== received ||
          closing.expected_cash_cents !== expectedNow,
      };
    }

    return {
      date,
      received_cents: received,
      totals,
      items: completed.map(item => ({
        id: item.id,
        date: item.date,
        client_name: item.client?.name || 'Cliente removido',
        provider_name: item.provider?.name || 'Barbeiro removido',
        service_name: item.service?.name || 'Serviço não informado',
        price_cents: item.price_cents,
        paid_cents: item.paid_cents,
        received_cents: receivedCents(item),
        payment_method: item.payment_method,
      })),
      memberships: payments.map(payment => ({
        id: payment.id,
        paid_at: payment.paid_at,
        client_name: payment.membership?.client?.name || 'Cliente removido',
        plan_name: payment.membership?.plan?.name || 'Plano removido',
        amount_cents: payment.amount_cents,
        payment_method: payment.payment_method,
      })),
      pending: pending.length,
      pending_items: pending.map(item => ({
        id: item.id,
        date: item.date,
        client_name: item.client?.name || 'Cliente removido',
        provider_id: item.provider_id,
        provider_name: item.provider?.name || 'Barbeiro removido',
        service_name: item.service?.name || 'Serviço não informado',
        price_cents: item.price_cents,
        included: !!item.membership_id,
      })),
      pending_days: await this.pendingDays(date),
      no_show: noShow,
      closing: closingView,
    };
  }

  public async close({
    date,
    opening_cents,
    counted_cents,
    notes = null,
    user_id,
  }: ICloseRequest): Promise<IResponse> {
    [opening_cents, counted_cents].forEach(value =>
      validatePayment(null, value),
    );

    if (opening_cents > MAX_PAID_CENTS || counted_cents > MAX_PAID_CENTS) {
      throw new AppError('Informe valores válidos.');
    }

    if (format(Date.now(), 'yyyy-MM-dd') < date) {
      throw new AppError(
        'Só é possível fechar o caixa de hoje ou de dias anteriores.',
      );
    }

    const { completed, payments } = await this.dayAppointments(date);
    const { totals, received } = this.sum(completed, payments);

    await this.cashClosingsRepository.save({
      date,
      opening_cents,
      counted_cents,
      expected_cash_cents: opening_cents + totals.cash.cents,
      received_cents: received,
      totals,
      notes: notes && notes.trim() ? notes.trim() : null,
      closed_by: user_id,
      closed_at: new Date(Date.now()),
    });

    return this.show(date);
  }

  // Dias anteriores (até PENDING_LOOKBACK_DAYS) com atendimentos sem registro
  private async pendingDays(date: string): Promise<IPendingDay[]> {
    const day = startOfDay(parseISO(date));
    const appointments = await this.appointmentsRepository.findAllInPeriod(
      subDays(day, PENDING_LOOKBACK_DAYS),
      new Date(day.getTime() - 1),
    );
    const counts = new Map<string, number>();

    appointments
      .filter(item => !item.canceled_at && !item.attendance)
      .forEach(item => {
        const key = format(item.date, 'yyyy-MM-dd');

        counts.set(key, (counts.get(key) || 0) + 1);
      });

    return Array.from(counts, ([key, count]) => ({ date: key, count })).sort(
      (a, b) => (a.date < b.date ? 1 : -1),
    );
  }

  // Atendimentos e mensalidades somados por forma de pagamento
  private sum(
    completed: Appointment[],
    payments: MembershipPayment[],
  ): { totals: PaymentTotals; received: number } {
    const totals = totalsByMethod(completed);
    let received = completed.reduce(
      (sum, item) => sum + receivedCents(item),
      0,
    );

    payments.forEach(payment => {
      totals[payment.payment_method].count += 1;
      totals[payment.payment_method].cents += payment.amount_cents;
      received += payment.amount_cents;
    });

    return { totals, received };
  }

  private async dayAppointments(date: string): Promise<{
    completed: Appointment[];
    pending: Appointment[];
    noShow: number;
    payments: MembershipPayment[];
  }> {
    const day = parseISO(date);

    if (Number.isNaN(day.getTime())) {
      throw new AppError('Informe uma data válida.');
    }

    const appointments = (
      await this.appointmentsRepository.findAllInPeriod(
        startOfDay(day),
        endOfDay(day),
      )
    ).filter(item => !item.canceled_at);
    const now = new Date(Date.now());
    const payments = this.membershipPaymentsRepository
      ? await this.membershipPaymentsRepository.findPaidInPeriod(
          startOfDay(day),
          endOfDay(day),
        )
      : [];

    return {
      payments,
      completed: appointments
        .filter(item => item.attendance === 'completed')
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
      pending: appointments.filter(
        item => !item.attendance && !isBefore(now, item.date),
      ),
      noShow: appointments.filter(item => item.attendance === 'no_show').length,
    };
  }
}

export default CashRegisterService;
