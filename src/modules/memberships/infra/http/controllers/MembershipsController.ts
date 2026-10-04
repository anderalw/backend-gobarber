import { Request, Response } from 'express';
import { container } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import IServicesRepository from '@modules/catalog/repositories/IServicesRepository';
import MembershipsService from '@modules/memberships/services/MembershipsService';
import MembershipPlansService from '@modules/memberships/services/MembershipPlansService';
import MembershipBenefitService from '@modules/memberships/services/MembershipBenefitService';
import ClubOverviewService from '@modules/memberships/services/ClubOverviewService';

// Prévia do benefício para a tela de agendamento
async function benefit(
  client_id: string,
  service_id: string,
  date: Date,
): Promise<unknown> {
  const service = await container
    .resolve<IServicesRepository>('ServicesRepository')
    .findById(service_id);

  if (!service) {
    throw new AppError('Serviço não encontrado.');
  }

  return container.resolve(MembershipBenefitService).evaluate({
    client_id,
    service_id,
    price_cents: service.price_cents,
    date,
  });
}

function payment(request: Request) {
  const { payment_method, amount_cents } = request.body;

  return { payment_method, amount_cents, user_id: request.user.id };
}

export default class MembershipsController {
  // Site: os planos que aceitam assinatura
  public async publicPlans(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(
      await container.resolve(MembershipPlansService).list(true),
    );
  }

  public async plans(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container.resolve(MembershipPlansService).list(false),
    );
  }

  public async createPlan(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response
      .status(201)
      .json(
        await container.resolve(MembershipPlansService).create(request.body),
      );
  }

  public async updatePlan(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(
      await container
        .resolve(MembershipPlansService)
        .update(request.params.id, request.body),
    );
  }

  public async overview(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(
      await container.resolve(ClubOverviewService).execute(),
    );
  }

  public async forClient(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(
      await container
        .resolve(MembershipsService)
        .forClient(request.params.client_id),
    );
  }

  public async subscribe(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const memberships = container.resolve(MembershipsService);
    const membership = await memberships.subscribe({
      client_id: request.body.client_id,
      plan_id: request.body.plan_id,
      ...payment(request),
    });

    return response.status(201).json(await memberships.details(membership));
  }

  public async confirm(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const memberships = container.resolve(MembershipsService);
    const membership = await memberships.confirm(
      request.params.id,
      payment(request),
    );

    return response.json(await memberships.details(membership));
  }

  public async pay(request: Request, response: Response): Promise<Response> {
    const memberships = container.resolve(MembershipsService);
    const membership = await memberships.registerPayment(
      request.params.id,
      payment(request),
    );

    return response.json(await memberships.details(membership));
  }

  public async cancel(request: Request, response: Response): Promise<Response> {
    const memberships = container.resolve(MembershipsService);
    const membership = await memberships.cancel(request.params.id);

    return response.json(memberships.view(membership, new Date(Date.now())));
  }

  public async benefit(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { client_id, service_id, date } = request.query;

    return response.json(
      await benefit(
        String(client_id),
        String(service_id),
        new Date(String(date)),
      ),
    );
  }

  // Cliente logado: a própria assinatura
  public async mine(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container.resolve(MembershipsService).forClient(request.user.id),
    );
  }

  public async request(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const memberships = container.resolve(MembershipsService);
    const membership = await memberships.request(
      request.user.id,
      request.body.plan_id,
    );

    return response.status(201).json(await memberships.details(membership));
  }

  // O cliente desiste do pedido (só enquanto a barbearia não confirmou)
  public async withdraw(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const memberships = container.resolve(MembershipsService);
    const current = await memberships.forClient(request.user.id);

    if (!current || current.status !== 'pending') {
      throw new AppError(
        'Não há pedido aguardando. Para cancelar a assinatura, fale com a equipe.',
      );
    }

    await memberships.cancel(current.id);

    return response.status(204).send();
  }

  public async myBenefit(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { service_id, date } = request.query;

    return response.json(
      await benefit(
        request.user.id,
        String(service_id),
        new Date(String(date)),
      ),
    );
  }
}
