import { Request, Response } from 'express';
import { container } from 'tsyringe';

import CardChargeService from '@modules/payments/services/CardChargeService';
import TerminalSettingsService from '@modules/payments/services/TerminalSettingsService';
import TerminalDevicesService from '@modules/payments/services/TerminalDevicesService';
import CardCharge from '@modules/payments/infra/typeorm/entities/CardCharge';

// O que a tela precisa de uma cobrança
function view(charge: CardCharge) {
  return {
    id: charge.id,
    appointment_id: charge.appointment_id,
    status: charge.status,
    method: charge.method,
    amount_cents: charge.amount_cents,
    device_id: charge.device_id,
    device_name: charge.device_name,
    message: charge.message,
    created_at: charge.created_at,
    resolved_at: charge.resolved_at,
  };
}

export default class CardChargesController {
  public async settings(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(
      await container.resolve(TerminalSettingsService).get(),
    );
  }

  // Tela de Configurações: credenciais mascaradas e todas as maquininhas
  public async adminSettings(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(
      await container.resolve(TerminalSettingsService).get(true),
    );
  }

  public async updateSettings(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { provider, credentials } = request.body;

    return response.json(
      await container
        .resolve(TerminalSettingsService)
        .update(provider || null, credentials || {}),
    );
  }

  public async testConnection(
    request: Request,
    response: Response,
  ): Promise<Response> {
    await container.resolve(TerminalSettingsService).test();

    return response.status(204).send();
  }

  public async discoverDevices(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(
      await container.resolve(TerminalDevicesService).discover(),
    );
  }

  public async createDevice(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { external_id, name } = request.body;

    await container
      .resolve(TerminalDevicesService)
      .create({ external_id, name });

    return response
      .status(201)
      .json(await container.resolve(TerminalSettingsService).get(true));
  }

  public async updateDevice(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { name, active } = request.body;

    await container
      .resolve(TerminalDevicesService)
      .update(request.params.id, { name, active });

    return response.json(
      await container.resolve(TerminalSettingsService).get(true),
    );
  }

  public async deleteDevice(
    request: Request,
    response: Response,
  ): Promise<Response> {
    await container.resolve(TerminalDevicesService).delete(request.params.id);

    return response.json(
      await container.resolve(TerminalSettingsService).get(true),
    );
  }

  public async create(request: Request, response: Response): Promise<Response> {
    const { appointment_id, device_id, amount_cents } = request.body;

    const charge = await container.resolve(CardChargeService).start({
      appointment_id,
      device_id,
      amount_cents,
      requester_id: request.user.id,
    });

    return response.status(201).json(view(charge));
  }

  // Consultado pela tela a cada poucos segundos enquanto aguarda
  public async show(request: Request, response: Response): Promise<Response> {
    const charge = await container
      .resolve(CardChargeService)
      .refresh(request.params.id);

    return response.json(view(charge));
  }

  public async cancel(request: Request, response: Response): Promise<Response> {
    const charge = await container
      .resolve(CardChargeService)
      .cancel(request.params.id);

    return response.json(view(charge));
  }
}
