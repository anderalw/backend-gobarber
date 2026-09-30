import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import { MAX_PAID_CENTS } from '@modules/appointments/utils/payment';
import MembershipPlan from '../infra/typeorm/entities/MembershipPlan';
import IMembershipPlansRepository, {
  IPlanData,
} from '../repositories/IMembershipPlansRepository';

export interface IPlanView extends IPlanData {
  id: string;
  items: Array<{
    service_id: string;
    service_name: string;
    quantity: number | null;
  }>;
}

// Planos do clube: o admin cria e edita; o site mostra os ativos
@injectable()
class MembershipPlansService {
  constructor(
    @inject('MembershipPlansRepository')
    private plansRepository: IMembershipPlansRepository,

    @inject('ServicesRepository')
    private servicesRepository: IServicesRepository,
  ) {}

  public async list(only_active: boolean): Promise<IPlanView[]> {
    const plans = await this.plansRepository.findAll({ only_active });

    return this.view(plans);
  }

  public async create(data: IPlanData): Promise<IPlanView> {
    const plan = await this.plansRepository.create(await this.validate(data));

    return (await this.view([plan]))[0];
  }

  public async update(id: string, data: IPlanData): Promise<IPlanView> {
    const plan = await this.plansRepository.findById(id);

    if (!plan) {
      throw new AppError('Plano não encontrado.', 404);
    }

    Object.assign(plan, await this.validate(data));

    return (await this.view([await this.plansRepository.save(plan)]))[0];
  }

  // Com o nome dos serviços (os removidos do catálogo somem do plano)
  public async view(plans: MembershipPlan[]): Promise<IPlanView[]> {
    const services = await this.servicesRepository.findAll({
      only_active: false,
    });
    const names = new Map(services.map(service => [service.id, service.name]));

    return plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price_cents: plan.price_cents,
      min_interval_days: plan.min_interval_days,
      weekdays: plan.weekdays,
      discount_percent: plan.discount_percent,
      active: plan.active,
      items: plan.items
        .filter(item => names.has(item.service_id))
        .map(item => ({
          service_id: item.service_id,
          service_name: names.get(item.service_id) as string,
          quantity: item.quantity,
        })),
    }));
  }

  private async validate(data: IPlanData): Promise<IPlanData> {
    const name = data.name.trim();

    if (!name) throw new AppError('Informe o nome do plano.');

    if (
      !Number.isInteger(data.price_cents) ||
      data.price_cents < 100 ||
      data.price_cents > MAX_PAID_CENTS
    ) {
      throw new AppError('Informe uma mensalidade a partir de R$ 1,00.');
    }

    if (data.items.length === 0) {
      throw new AppError('Inclua pelo menos um serviço no plano.');
    }

    const ids = data.items.map(item => item.service_id);

    if (new Set(ids).size !== ids.length) {
      throw new AppError('Cada serviço entra uma vez só no plano.');
    }

    const services = await this.servicesRepository.findAll({
      only_active: false,
    });

    if (ids.some(id => !services.some(service => service.id === id))) {
      throw new AppError('Serviço não encontrado.');
    }

    data.items.forEach(item => {
      if (
        item.quantity !== null &&
        (!Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 31)
      ) {
        throw new AppError('A quantidade por mês vai de 1 a 31.');
      }
    });

    const weekdays = data.weekdays
      ? Array.from(new Set(data.weekdays)).sort()
      : null;

    if (weekdays && weekdays.length === 0) {
      throw new AppError('Escolha pelo menos um dia da semana.');
    }

    return {
      name,
      description: data.description?.trim() || null,
      price_cents: data.price_cents,
      items: data.items.map(item => ({
        service_id: item.service_id,
        quantity: item.quantity,
      })),
      min_interval_days: data.min_interval_days || null,
      // Todos os dias marcados = sem restrição
      weekdays: weekdays && weekdays.length < 7 ? weekdays : null,
      discount_percent: data.discount_percent,
      active: data.active,
    };
  }
}

export default MembershipPlansService;
