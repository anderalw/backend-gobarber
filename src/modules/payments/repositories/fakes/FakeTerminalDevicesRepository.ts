import { randomUUID } from 'crypto';

import ITerminalDevicesRepository, {
  ICreateTerminalDeviceDTO,
} from '../ITerminalDevicesRepository';
import TerminalDevice from '../../infra/typeorm/entities/TerminalDevice';

class FakeTerminalDevicesRepository implements ITerminalDevicesRepository {
  public devices: TerminalDevice[] = [];

  public async create(data: ICreateTerminalDeviceDTO): Promise<TerminalDevice> {
    const device = Object.assign(new TerminalDevice(), {
      id: randomUUID(),
      active: true,
      created_at: new Date(Date.now()),
      updated_at: new Date(Date.now()),
      ...data,
    });

    this.devices.push(device);

    return device;
  }

  public async save(device: TerminalDevice): Promise<TerminalDevice> {
    const index = this.devices.findIndex(item => item.id === device.id);

    this.devices[index] = device;

    return device;
  }

  public async delete(id: string): Promise<void> {
    this.devices = this.devices.filter(device => device.id !== id);
  }

  public async findById(id: string): Promise<TerminalDevice | undefined> {
    return this.devices.find(device => device.id === id);
  }

  public async findByProvider(provider: string): Promise<TerminalDevice[]> {
    return this.devices
      .filter(device => device.provider === provider)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

export default FakeTerminalDevicesRepository;
