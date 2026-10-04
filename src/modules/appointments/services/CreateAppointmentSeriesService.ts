import { injectable, inject } from 'tsyringe';
import { addWeeks, format } from 'date-fns';

import AppError from '@shared/errors/AppError';
import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import IAppointmentSeriesRepository from '../repositories/IAppointmentSeriesRepository';
import IClientNotifier from '../notifier/IClientNotifier';
import CheckSlotService from './CheckSlotService';
import CreateAppointmentsService from './CreateAppointmentsService';

export const MAX_INTERVAL_WEEKS = 8;
export const MIN_OCCURRENCES = 2;
export const MAX_OCCURRENCES = 26;

interface IRequest {
  // Barbeiro logado que está marcando
  requester_id: string;
  provider_id: string;
  service_id: string;
  client_id: string;
  // Primeiro horário; os outros são a cada interval_weeks semanas
  date: Date;
  interval_weeks: number;
  count: number;
  // true: só confere quais horários estão livres, sem marcar
  dry_run?: boolean;
}

interface IOccurrence {
  date: Date;
  available: boolean;
  // Por que não dá para marcar (horário ocupado, folga...)
  reason: string | null;
}

interface IResponse {
  // null na prévia
  series_id: string | null;
  // Na prévia: todos os horários, livres ou não. Depois de marcar: os que
  // foram marcados (available) e os pulados
  occurrences: IOccurrence[];
  created: number;
}

// Cliente fixo: marca de uma vez o mesmo horário a cada N semanas. Os
// horários que não estão livres são pulados (a prévia mostra quais)
@injectable()
class CreateAppointmentSeriesService {
  constructor(
    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,

    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('AppointmentSeriesRepository')
    private seriesRepository: IAppointmentSeriesRepository,

    @inject('NotificationsRepository')
    private notificationsRepository: INotificationsRepository,

    @inject('ClientNotifier')
    private clientNotifier: IClientNotifier,

    @inject(CheckSlotService)
    private checkSlot: CheckSlotService,

    @inject(CreateAppointmentsService)
    private createAppointment: CreateAppointmentsService,
  ) {}

  public async execute({
    requester_id,
    provider_id,
    service_id,
    client_id,
    date,
    interval_weeks,
    count,
    dry_run = false,
  }: IRequest): Promise<IResponse> {
    if (
      !Number.isInteger(interval_weeks) ||
      interval_weeks < 1 ||
      interval_weeks > MAX_INTERVAL_WEEKS
    ) {
      throw new AppError(
        `A repetição deve ser de 1 a ${MAX_INTERVAL_WEEKS} semanas.`,
      );
    }

    if (
      !Number.isInteger(count) ||
      count < MIN_OCCURRENCES ||
      count > MAX_OCCURRENCES
    ) {
      throw new AppError(
        `Escolha de ${MIN_OCCURRENCES} a ${MAX_OCCURRENCES} horários.`,
      );
    }

    const provider = await this.usersRepository.findById(provider_id);

    if (!provider) {
      throw new AppError('Profissional não encontrado.');
    }

    if (!(await this.clientsRepository.findById(client_id))) {
      throw new AppError('Cliente não encontrado.');
    }

    const dates = Array.from({ length: count }, (_, index) =>
      addWeeks(date, index * interval_weeks),
    );

    const preview: IOccurrence[] = [];

    // Em sequência: são poucos horários e cada um consulta a agenda
    // eslint-disable-next-line no-restricted-syntax
    for (const occurrence of dates) {
      // eslint-disable-next-line no-await-in-loop
      const check = await this.checkSlot.execute({
        provider_id,
        service_id,
        date: occurrence,
      });

      preview.push({
        date: occurrence,
        available: check.available,
        reason: check.available ? null : check.reason,
      });
    }

    if (dry_run) {
      return {
        series_id: null,
        occurrences: preview,
        created: preview.filter(item => item.available).length,
      };
    }

    if (!preview.some(item => item.available)) {
      throw new AppError('Nenhum dos horários está livre.');
    }

    const series = await this.seriesRepository.create({
      client_id,
      provider_id,
      service_id,
      interval_weeks,
      created_by: requester_id,
    });

    const created: Appointment[] = [];
    const occurrences: IOccurrence[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const item of preview) {
      if (!item.available) {
        occurrences.push(item);
        // eslint-disable-next-line no-continue
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        const appointment = await this.createAppointment.execute({
          provider_id,
          service_id,
          client_id,
          date: item.date,
          series_id: series.id,
          // Um aviso só para a série inteira (abaixo)
          notifyProvider: false,
          notifyClient: false,
        });

        created.push(appointment);
        occurrences.push(item);
      } catch (err) {
        // Alguém ocupou o horário depois da prévia: pula este
        if (!(err instanceof AppError)) throw err;

        occurrences.push({ ...item, available: false, reason: err.message });
      }
    }

    if (created.length > 0) {
      const first = created[0];
      const full = await Promise.all(
        created.map(
          async appointment =>
            (await this.appointmentsRepository.findById(appointment.id)) ||
            appointment,
        ),
      );
      const serviceName = full[0].service?.name || 'serviço';

      if (requester_id !== provider_id) {
        await this.notificationsRepository.create({
          recipient_id: provider_id,
          content: `Cliente fixo: ${
            created.length
          } agendamentos de ${serviceName} a cada ${interval_weeks} ${
            interval_weeks === 1 ? 'semana' : 'semanas'
          }, a partir de ${format(first.date, "dd/MM/yyyy 'às' HH:mm")}`,
          date: first.date,
        });
      }

      await this.clientNotifier.seriesCreated(full, interval_weeks);
    }

    return { series_id: series.id, occurrences, created: created.length };
  }
}

export default CreateAppointmentSeriesService;
