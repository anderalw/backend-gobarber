// Sem entidades do TypeORM (que carregam o polyfill), o tsyringe precisa dele
import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';

import AppError from '@shared/errors/AppError';
import { ITerminalDevice } from '../providers/TerminalProvider/models/ITerminalProvider';
import ITerminalDevicesRepository from '../repositories/ITerminalDevicesRepository';
import TerminalDevice from '../infra/typeorm/entities/TerminalDevice';
import TerminalSettingsService, {
  IActiveTerminal,
} from './TerminalSettingsService';

interface IDeviceData {
  external_id: string;
  name: string;
}

// Cadastro das maquininhas da barbearia na operadora em uso
@injectable()
class TerminalDevicesService {
  constructor(
    @inject('TerminalDevicesRepository')
    private devicesRepository: ITerminalDevicesRepository,

    @inject(TerminalSettingsService)
    private terminalSettings: TerminalSettingsService,
  ) {}

  // Aparelhos da conta na operadora que ainda não foram cadastrados
  public async discover(): Promise<ITerminalDevice[]> {
    const { provider, credentials } = await this.terminal();
    const [found, registered] = await Promise.all([
      provider.listDevices(credentials),
      this.devicesRepository.findByProvider(provider.key),
    ]);

    return found.filter(
      device => !registered.some(item => item.external_id === device.id),
    );
  }

  public async create({
    external_id,
    name,
  }: IDeviceData): Promise<TerminalDevice> {
    const { provider } = await this.terminal();
    const id = external_id.trim();

    await this.ensureUnique(provider.key, id);

    return this.devicesRepository.create({
      provider: provider.key,
      external_id: id,
      name: name.trim(),
    });
  }

  public async update(
    id: string,
    data: { name?: string; active?: boolean },
  ): Promise<TerminalDevice> {
    const device = await this.find(id);

    if (data.name !== undefined) device.name = data.name.trim();
    if (data.active !== undefined) device.active = data.active;

    return this.devicesRepository.save(device);
  }

  // As cobranças antigas guardam o nome e o id do aparelho, não se perdem
  public async delete(id: string): Promise<void> {
    await this.find(id);
    await this.devicesRepository.delete(id);
  }

  private async terminal(): Promise<IActiveTerminal> {
    const terminal = await this.terminalSettings.active();

    if (!terminal) {
      throw new AppError('Conecte a conta da operadora primeiro.');
    }

    return terminal;
  }

  private async find(id: string): Promise<TerminalDevice> {
    const device = await this.devicesRepository.findById(id);

    if (!device) {
      throw new AppError('Maquininha não encontrada.', 404);
    }

    return device;
  }

  private async ensureUnique(
    provider: string,
    external_id: string,
  ): Promise<void> {
    const registered = await this.devicesRepository.findByProvider(provider);

    if (registered.some(device => device.external_id === external_id)) {
      throw new AppError('Esta maquininha já está cadastrada.');
    }
  }
}

export default TerminalDevicesService;
