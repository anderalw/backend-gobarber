import { randomUUID } from 'crypto';

import AppError from '@shared/errors/AppError';
import { ChargeMethod } from '../../../infra/typeorm/entities/CardCharge';
import ITerminalProvider, {
  ITerminalChargeStatus,
  ITerminalCredentialField,
  ITerminalCredentials,
  ITerminalDevice,
} from '../models/ITerminalProvider';

interface ISimulatedCharge extends ITerminalChargeStatus {
  external_id: string;
  device_id: string;
  amount_cents: number;
  description: string;
  created_at: Date;
}

// Cobrança parada na maquininha por mais que isso vence (como nas reais)
const EXPIRES_IN_MS = 10 * 60 * 1000;

// Aparelhos "vinculados" à conta de teste (qualquer id pode ser cadastrado)
const DEVICES: ITerminalDevice[] = [
  { id: 'sim-balcao', name: 'Maquininha do balcão (simulada)' },
  { id: 'sim-cadeira-2', name: 'Maquininha da cadeira 2 (simulada)' },
];

// Maquininha de mentira, para testar sem operadora: as cobranças ficam na
// memória do servidor e a tela "Maquininha virtual" aprova ou recusa
export default class SimulatorTerminalProvider implements ITerminalProvider {
  public readonly key = 'simulator';

  public readonly label = 'Simulador (testes)';

  public readonly credentialFields: ITerminalCredentialField[] = [
    {
      key: 'access_token',
      label: 'Chave de acesso',
      secret: true,
      required: true,
      placeholder: 'sim_minha_barbearia',
      help: 'No simulador, qualquer chave que comece com "sim_".',
    },
  ];

  public readonly setupHelp =
    'Para testar sem maquininha: use uma chave começando com "sim_" e cadastre os aparelhos simulados (ou qualquer número de série inventado).';

  public readonly deviceIdLabel = 'Número de série';

  public readonly deviceIdHelp =
    'No simulador pode ser qualquer código, por exemplo sim-balcao.';

  private charges = new Map<string, ISimulatedCharge>();

  public async verify(credentials: ITerminalCredentials): Promise<void> {
    if (!/^sim_\S{3,}$/.test(credentials.access_token || '')) {
      throw new AppError(
        'Chave de acesso inválida: no simulador ela começa com "sim_".',
      );
    }
  }

  public async listDevices(
    credentials: ITerminalCredentials,
  ): Promise<ITerminalDevice[]> {
    await this.verify(credentials);

    return DEVICES;
  }

  public async createCharge(
    credentials: ITerminalCredentials,
    {
      device_id,
      amount_cents,
      description,
    }: {
      device_id: string;
      amount_cents: number;
      description: string;
    },
  ): Promise<{ external_id: string }> {
    await this.verify(credentials);

    // Como nas reais: uma cobrança por vez em cada maquininha
    this.pendingFor(device_id).forEach(item => {
      Object.assign(item, { status: 'canceled' });
    });

    const external_id = `sim_${randomUUID()}`;

    this.charges.set(external_id, {
      external_id,
      device_id,
      amount_cents,
      description,
      status: 'pending',
      created_at: new Date(Date.now()),
    });

    return { external_id };
  }

  public async getStatus(
    _credentials: ITerminalCredentials,
    external_id: string,
  ): Promise<ITerminalChargeStatus> {
    const charge = this.charges.get(external_id);

    // Servidor reiniciado: a cobrança simulada se perdeu
    if (!charge) {
      return { status: 'expired', message: 'Cobrança não encontrada.' };
    }

    if (
      charge.status === 'pending' &&
      Date.now() - charge.created_at.getTime() > EXPIRES_IN_MS
    ) {
      charge.status = 'expired';
      charge.message = 'Tempo esgotado na maquininha.';
    }

    return {
      status: charge.status,
      method: charge.method,
      paid_cents: charge.paid_cents,
      message: charge.message,
    };
  }

  public async cancel(
    _credentials: ITerminalCredentials,
    external_id: string,
  ): Promise<void> {
    const charge = this.charges.get(external_id);

    if (charge && charge.status === 'pending') {
      charge.status = 'canceled';
    }
  }

  // Tela da maquininha virtual: a cobrança esperando em cada aparelho
  public pendingFor(device_id: string): ISimulatedCharge[] {
    return Array.from(this.charges.values()).filter(
      item => item.device_id === device_id && item.status === 'pending',
    );
  }

  // O "cliente passou o cartão" (ou a maquininha recusou)
  public resolve(
    external_id: string,
    result: ChargeMethod | 'rejected',
  ): ISimulatedCharge {
    const charge = this.charges.get(external_id);

    if (!charge || charge.status !== 'pending') {
      throw new AppError('Não há cobrança aguardando nesta maquininha.', 404);
    }

    if (result === 'rejected') {
      charge.status = 'rejected';
      charge.message = 'Pagamento recusado pela maquininha.';
    } else {
      charge.status = 'approved';
      charge.method = result;
      charge.paid_cents = charge.amount_cents;
    }

    return charge;
  }
}
