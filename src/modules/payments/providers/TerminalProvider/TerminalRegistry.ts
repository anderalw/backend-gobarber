import { injectable, inject } from 'tsyringe';

import ITerminalProvider from './models/ITerminalProvider';

// Operadoras com maquininha integrável que ainda vão ganhar implementação.
// Aparecem na tela como "em breve"; ao implementar, a operadora sai daqui
// e entra no construtor abaixo
export const UPCOMING_PROVIDERS: Array<{ key: string; label: string }> = [
  { key: 'mercadopago', label: 'Mercado Pago Point' },
  { key: 'stone', label: 'Stone' },
  { key: 'cielo', label: 'Cielo LIO' },
  { key: 'pagbank', label: 'PagBank' },
  { key: 'sumup', label: 'SumUp' },
];

// Operadoras de maquininha disponíveis no sistema. Uma nova operadora entra
// aqui (e na lista do container), sem mudar quem cobra
@injectable()
export default class TerminalRegistry {
  private providers: ITerminalProvider[];

  constructor(
    @inject('SimulatorTerminalProvider')
    simulator: ITerminalProvider,
  ) {
    this.providers = [simulator];
  }

  public list(): ITerminalProvider[] {
    return this.providers;
  }

  // As "em breve" que ainda não têm implementação
  public upcoming(): Array<{ key: string; label: string }> {
    return UPCOMING_PROVIDERS.filter(item => !this.get(item.key));
  }

  public get(key: string): ITerminalProvider | undefined {
    return this.providers.find(provider => provider.key === key);
  }
}
