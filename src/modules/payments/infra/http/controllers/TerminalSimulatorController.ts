import { Request, Response } from 'express';
import { container } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import SimulatorTerminalProvider from '@modules/payments/providers/TerminalProvider/implementations/SimulatorTerminalProvider';

function simulator(): SimulatorTerminalProvider {
  return container.resolve<SimulatorTerminalProvider>(
    'SimulatorTerminalProvider',
  );
}

// A "maquininha virtual": mostra a cobrança que chegou e deixa aprovar ou
// recusar, como se o cliente passasse o cartão
export default class TerminalSimulatorController {
  public async show(request: Request, response: Response): Promise<Response> {
    const provider = simulator();
    const devices = await provider.listDevices();

    return response.json(
      devices.map(device => {
        const [charge] = provider.pendingFor(device.id);

        return {
          ...device,
          charge: charge
            ? {
                external_id: charge.external_id,
                amount_cents: charge.amount_cents,
                description: charge.description,
              }
            : null,
        };
      }),
    );
  }

  public async resolve(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const { result } = request.body;

    if (!['credit', 'debit', 'pix', 'rejected'].includes(result)) {
      throw new AppError('Resultado inválido.');
    }

    const charge = simulator().resolve(request.params.external_id, result);

    return response.json({ status: charge.status, method: charge.method });
  }
}
