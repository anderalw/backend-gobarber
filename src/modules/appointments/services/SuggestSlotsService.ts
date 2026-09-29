import { injectable, inject } from 'tsyringe';
import { endOfDay, startOfDay } from 'date-fns';

import AppError from '@shared/errors/AppError';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import IAppointmentsRepository from '../repositories/IAppointmentsRepository';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';
import findFreeStarts from '../utils/findFreeStarts';
import blocksAsBusy from '../utils/blocksAsBusy';
import workWindow from '../utils/workWindow';
import CheckSlotService from './CheckSlotService';

interface IRequest {
  provider_id: string;
  service_id: string;
  // Horário escolhido (ex: clicado na agenda) em que o serviço não coube
  date: Date;
}

interface IResponse {
  // Horários livres mais próximos com o mesmo barbeiro, em ordem
  before: Date[];
  after: Date[];
  // Outros barbeiros livres exatamente no horário escolhido
  others: Array<{ id: string; name: string; avatar_url: string | null }>;
}

// Quantos horários sugerir de cada lado do escolhido
const PER_SIDE = 2;

@injectable()
class SuggestSlotsService {
  constructor(
    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,

    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,

    @inject(AgendaSettingsService)
    private agendaSettings: AgendaSettingsService,

    @inject(CheckSlotService)
    private checkSlot: CheckSlotService,

    @inject('TimeBlocksRepository')
    private timeBlocksRepository: ITimeBlocksRepository,
  ) {}

  public async execute({
    provider_id,
    service_id,
    date,
  }: IRequest): Promise<IResponse> {
    const service = await this.servicesRepository.findById(service_id);

    if (!service || !service.active) {
      throw new AppError('Serviço não encontrado.', 404);
    }

    const [sameProvider, others] = await Promise.all([
      this.sameProviderStarts(provider_id, service.duration_minutes, date),
      this.otherProvidersAt(provider_id, service_id, date),
    ]);

    return {
      before: sameProvider
        .filter(start => start.getTime() < date.getTime())
        .slice(-PER_SIDE),
      after: sameProvider
        .filter(start => start.getTime() > date.getTime())
        .slice(0, PER_SIDE),
      others,
    };
  }

  private async sameProviderStarts(
    provider_id: string,
    durationMinutes: number,
    date: Date,
  ): Promise<Date[]> {
    const schedules = await this.providerSchedulesRepository.findByProviderId(
      provider_id,
    );
    const schedule = schedules.find(item => item.day_of_week === date.getDay());

    if (!schedule) return [];

    const [appointments, blocks, { buffer_minutes }] = await Promise.all([
      this.appointmentsRepository.findAllInDayFromProvider({
        provider_id,
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      }),
      this.timeBlocksRepository.findInRange({
        provider_id,
        start: startOfDay(date),
        end: endOfDay(date),
      }),
      this.agendaSettings.get(),
    ]);

    return findFreeStarts({
      ...workWindow(date, schedule),
      durationMinutes,
      bufferMinutes: buffer_minutes,
      busy: [
        ...appointments.map(appointment => ({
          start: appointment.date,
          end: appointment.blocked_until,
        })),
        ...blocksAsBusy(blocks, buffer_minutes),
      ],
      now: new Date(Date.now()),
    });
  }

  // Mesmas regras de quando o agendamento é gravado
  private async otherProvidersAt(
    provider_id: string,
    service_id: string,
    date: Date,
  ): Promise<IResponse['others']> {
    const providers = await this.usersRepository.findAllProviders({
      except_user_id: provider_id,
    });

    const checks = await Promise.all(
      providers.map(async provider => ({
        provider,
        result: await this.checkSlot.execute({
          provider_id: provider.id,
          service_id,
          date,
        }),
      })),
    );

    return checks
      .filter(({ result }) => result.available)
      .map(({ provider }) => ({
        id: provider.id,
        name: provider.name,
        avatar_url: provider.getAvatarUrl(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

export default SuggestSlotsService;
