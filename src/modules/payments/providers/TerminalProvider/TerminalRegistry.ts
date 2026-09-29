import { injectable, inject } from 'tsyringe';

import ITerminalProvider from './models/ITerminalProvider';

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

  public get(key: string): ITerminalProvider | undefined {
    return this.providers.find(provider => provider.key === key);
  }
}
