import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import IClientsRepository from '@modules/clients/repositories/IClientsRepository';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import IAppointmentsRepository from '@modules/appointments/repositories/IAppointmentsRepository';
import { PaymentMethod } from '@modules/appointments/infra/typeorm/entities/Appointment';
import {
  MAX_PAID_CENTS,
  PAYMENT_METHODS,
} from '@modules/appointments/utils/payment';
import SessionPackage from '../infra/typeorm/entities/SessionPackage';
import ISessionPackagesRepository from '../repositories/ISessionPackagesRepository';

export interface IPackageView {
  id: string;
  service_id: string;
  service_name: string;
  sessions: number;
  // Agendamentos ativos cobertos (marcados ou já feitos)
  used: number;
  remaining: number;
  price_cents: number;
  payment_method: PaymentMethod;
  paid_at: Date;
  canceled_at: Date | null;
  state: 'active' | 'used_up' | 'canceled';
}

interface ICreateRequest {
  client_id: string;
  service_id: string;
  sessions: number;
  price_cents: number;
  payment_method: PaymentMethod;
  user_id: string;
}

// Pacotes de sessões: venda, saldo e qual pacote cobre um agendamento
@injectable()
class PackagesService {
  constructor(
    @inject('SessionPackagesRepository')
    private packagesRepository: ISessionPackagesRepository,

    @inject('AppointmentsRepository')
    private appointmentsRepository: IAppointmentsRepository,

    @inject('ClientsRepository')
    private clientsRepository: IClientsRepository,

    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,
  ) {}

  public async listByClient(client_id: string): Promise<IPackageView[]> {
    const packages = await this.packagesRepository.findByClient(client_id);
    const used = await this.usedCounts(packages, undefined);

    return packages
      .map(item => this.view(item, used.get(item.id) || 0))
      .reverse();
  }

  public async create({
    client_id,
    service_id,
    sessions,
    price_cents,
    payment_method,
    user_id,
  }: ICreateRequest): Promise<IPackageView> {
    if (!Number.isInteger(sessions) || sessions < 1 || sessions > 100) {
      throw new AppError('Informe de 1 a 100 sessões.');
    }

    if (
      !Number.isInteger(price_cents) ||
      price_cents < 0 ||
      price_cents > MAX_PAID_CENTS
    ) {
      throw new AppError('Informe um valor válido.');
    }

    if (!PAYMENT_METHODS.includes(payment_method)) {
      throw new AppError('Forma de pagamento inválida.');
    }

    if (!(await this.clientsRepository.findById(client_id))) {
      throw new AppError('Cliente não encontrado.', 404);
    }

    const service = await this.servicesRepository.findById(service_id);

    if (!service || !service.active) {
      throw new AppError('Serviço não encontrado.');
    }

    const created = await this.packagesRepository.create({
      client_id,
      service_id,
      sessions,
      price_cents,
      payment_method,
      paid_at: new Date(Date.now()),
      received_by: user_id,
    });

    return this.view(Object.assign(created, { service }), 0);
  }

  // Deixa de cobrir horários; os já marcados e ainda não feitos voltam ao
  // preço normal
  public async cancel(id: string): Promise<IPackageView> {
    const item = await this.packagesRepository.findById(id);

    if (!item) {
      throw new AppError('Pacote não encontrado.', 404);
    }

    if (item.canceled_at) {
      throw new AppError('Este pacote já foi cancelado.');
    }

    item.canceled_at = new Date(Date.now());
    await this.packagesRepository.save(item);

    const covered = await this.appointmentsRepository.findByPackages([id]);
    const pending = covered.filter(appointment => !appointment.attendance);

    // eslint-disable-next-line no-restricted-syntax
    for (const appointment of pending) {
      appointment.package_id = null;
      appointment.price_cents =
        appointment.list_price_cents ?? appointment.price_cents;
      appointment.list_price_cents = null;
      // eslint-disable-next-line no-await-in-loop
      await this.appointmentsRepository.save(appointment);
    }

    return this.view(item, covered.length - pending.length);
  }

  // Pacote ativo do cliente que ainda tem sessão para o serviço (o mais
  // antigo primeiro); except_appointment_id não conta no saldo (remarcação)
  public async coverFor(
    client_id: string,
    service_id: string,
    except_appointment_id?: string,
  ): Promise<SessionPackage | null> {
    const packages = (
      await this.packagesRepository.findByClient(client_id)
    ).filter(item => !item.canceled_at && item.service_id === service_id);

    if (packages.length === 0) return null;

    const used = await this.usedCounts(packages, except_appointment_id);

    return (
      packages.find(item => (used.get(item.id) || 0) < item.sessions) || null
    );
  }

  private async usedCounts(
    packages: SessionPackage[],
    except_appointment_id: string | undefined,
  ): Promise<Map<string, number>> {
    const covered = await this.appointmentsRepository.findByPackages(
      packages.map(item => item.id),
    );
    const counts = new Map<string, number>();

    covered
      .filter(appointment => appointment.id !== except_appointment_id)
      .forEach(appointment => {
        const key = appointment.package_id as string;

        counts.set(key, (counts.get(key) || 0) + 1);
      });

    return counts;
  }

  private view(item: SessionPackage, used: number): IPackageView {
    const remaining = Math.max(0, item.sessions - used);
    let state: IPackageView['state'] = 'active';

    if (item.canceled_at) state = 'canceled';
    else if (remaining === 0) state = 'used_up';

    return {
      id: item.id,
      service_id: item.service_id,
      service_name: item.service?.name || 'Serviço removido',
      sessions: item.sessions,
      used,
      remaining,
      price_cents: item.price_cents,
      payment_method: item.payment_method,
      paid_at: item.paid_at,
      canceled_at: item.canceled_at,
      state,
    };
  }
}

export default PackagesService;
