import { Request, Response } from 'express';
import { container } from 'tsyringe';

import WhatsAppService from '@modules/messaging/services/WhatsAppService';
import WhatsAppSettingsService from '@modules/messaging/services/WhatsAppSettingsService';

export default class WhatsAppController {
  public async settings(
    request: Request,
    response: Response,
  ): Promise<Response> {
    return response.json(
      await container.resolve(WhatsAppSettingsService).get(),
    );
  }

  public async updateSettings(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { provider, credentials, groups } = request.body;

    return response.json(
      await container.resolve(WhatsAppSettingsService).update({
        provider: provider || null,
        credentials: credentials || {},
        groups,
      }),
    );
  }

  // A fila (envio assistido) ou o histórico
  public async index(request: Request, response: Response): Promise<Response> {
    const whatsapp = container.resolve(WhatsAppService);

    return response.json(
      request.query.list === 'history'
        ? await whatsapp.history()
        : await whatsapp.pending(),
    );
  }

  // Para o número no menu e o aviso da tela: quantas esperam e como envia
  public async count(request: Request, response: Response): Promise<Response> {
    const active = await container.resolve(WhatsAppSettingsService).active();

    return response.json({
      pending: await container.resolve(WhatsAppService).countPending(),
      enabled: !!active,
      automatic: !!active?.provider.automatic,
      provider_label: active ? active.provider.label : null,
    });
  }

  public async sent(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container
        .resolve(WhatsAppService)
        .markSent(request.params.id, request.user.id),
    );
  }

  public async skip(request: Request, response: Response): Promise<Response> {
    return response.json(
      await container
        .resolve(WhatsAppService)
        .skip(request.params.id, request.user.id),
    );
  }
}
