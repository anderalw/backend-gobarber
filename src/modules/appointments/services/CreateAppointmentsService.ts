import { format, setMilliseconds, setSeconds } from 'date-fns';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import ICacheProvider from '@shared/container/providers/CacheProvider/models/ICacheProvider';

import INotificationsRepository from '@modules/notifications/repositories/INotificationsRepository';
import IProviderSchedulesRepository from '@modules/users/repositories/IProviderSchedulesRepository';
import IUsersRepository from '@modules/users/repositories/IUsersRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import AgendaSettingsService from '@modules/catalog/services/AgendaSettingsService';
import MembershipBenefitService from '@modules/memberships/services/MembershipBenefitService';
import FeaturesService from '@modules/catalog/services/FeaturesService';
import PackagesService from '@modules/packages/services/PackagesService';
import Appointment from '../infra/typeorm/entities/Appointment';
import IAppointmentsRepaository from '../repositories/IAppointmentsRepository';
import ITimeBlocksRepository from '../repositories/ITimeBlocksRepository';
import IClientNotifier from '../notifier/IClientNotifier';
import checkAvailableSlot from '../utils/checkAvailableSlot';

interface IRequest {
  provider_id: string;
  service_id: string;
  date: Date;
  client_id: string;
  // false quando o próprio barbeiro marcou na agenda dele
  notifyProvider?: boolean;
  // false no cliente fixo: um e-mail só para a série inteira
  notifyClient?: boolean;
  series_id?: string | null;
}
@injectable()
class CreateAppointmentsServices {
  constructor(
    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepaository,

    @inject('NotificationsRepository')
    private notificationsRepository: INotificationsRepository,

    @inject('CacheProvider')
    private cacheProvider: ICacheProvider,

    @inject('ProviderSchedulesRepository')
    private providerSchedulesRepository: IProviderSchedulesRepository,

    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,

    @inject(AgendaSettingsService)
    private agendaSettings: AgendaSettingsService,

    @inject('UsersRepository')
    private usersRepository: IUsersRepository,

    @inject('TimeBlocksRepository')
    private timeBlocksRepository: ITimeBlocksRepository,
    @inject('ClientNotifier')
    private clientNotifier: IClientNotifier,

    // Clube: incluso no plano ou com desconto (opcional nos testes que não
    // envolvem o clube)
    @inject(MembershipBenefitService)
    private membershipBenefit?: MembershipBenefitService,

    // Recursos do ramo (pacotes e sinal); opcionais nos testes antigos
    @inject(FeaturesService)
    private features?: FeaturesService,

    @inject(PackagesService)
    private packages?: PackagesService,
  ) {}

  public async execute({
    date,
    provider_id,
    client_id,
    service_id,
    notifyProvider = true,
    notifyClient = true,
    series_id = null,
  }: IRequest): Promise<Appointment> {
    const appointmentDate = setMilliseconds(setSeconds(date, 0), 0);

    if (client_id === provider_id) {
      throw new AppError('Não é possível agendar consigo mesmo.');
    }

    const service = await this.servicesRepository.findById(service_id);

    if (!service || !service.active) {
      throw new AppError('Serviço não encontrado.');
    }

    const { end, blockedUntil } = await checkAvailableSlot(
      {
        usersRepository: this.usersRepository,
        appointmentsRepository: this.appointmentsRepository,
        providerSchedulesRepository: this.providerSchedulesRepository,
        agendaSettings: this.agendaSettings,
        timeBlocksRepository: this.timeBlocksRepository,
      },
      {
        provider_id,
        start: appointmentDate,
        durationMinutes: service.duration_minutes,
      },
    );

    // Pacote de sessões do serviço: incluso, sem passar pelo clube
    const sessionPackage =
      this.features && this.packages && (await this.features.isOn('packages'))
        ? await this.packages.coverFor(client_id, service.id)
        : null;

    const benefit =
      this.membershipBenefit && !sessionPackage
        ? await this.membershipBenefit.evaluate({
            client_id,
            service_id: service.id,
            price_cents: service.price_cents,
            date: appointmentDate,
          })
        : null;

    let price = benefit ? benefit.price_cents : service.price_cents;

    if (sessionPackage) price = 0;

    // Sinal do serviço (só quando há algo a pagar)
    const deposit =
      this.features &&
      service.deposit_cents &&
      price > 0 &&
      (await this.features.isOn('deposit'))
        ? Math.min(service.deposit_cents, price)
        : null;

    const appointment = await this.appointmentsRepository.create({
      provider_id,
      client_id,
      service_id: service.id,
      // Guarda o valor do momento: mudar o preço depois não altera o histórico
      price_cents: price,
      membership_id: benefit?.membership_id ?? null,
      list_price_cents: sessionPackage
        ? service.price_cents
        : benefit?.list_price_cents ?? null,
      package_id: sessionPackage?.id ?? null,
      deposit_cents: deposit,
      date: appointmentDate,
      end_date: end,
      blocked_until: blockedUntil,
      series_id,
    });
    const dateFormatted = format(appointmentDate, "dd/MM/yyyy 'às' HH:mm'h'");

    if (notifyProvider) {
      await this.notificationsRepository.create({
        recipient_id: provider_id,
        content: `Novo agendamento de ${service.name} para dia ${dateFormatted}`,
        date: appointmentDate,
      });
    }

    await this.cacheProvider.invalidate(
      `provider-appointments:${provider_id}:${format(
        appointmentDate,
        'yyyy-M-d',
      )}`,
    );

    if (notifyClient) {
      // Com cliente, barbeiro e serviço para o e-mail
      const full = await this.appointmentsRepository.findById(appointment.id);
      await this.clientNotifier.appointmentCreated(full || appointment);
    }

    return appointment;
  }
}
export default CreateAppointmentsServices;
