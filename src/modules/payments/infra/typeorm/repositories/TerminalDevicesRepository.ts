import { Repository } from 'typeorm';

import dataSource from '@shared/infra/typeorm/dataSource';
import ITerminalDevicesRepository, {
  ICreateTerminalDeviceDTO,
} from '@modules/payments/repositories/ITerminalDevicesRepository';

import TerminalDevice from '../entities/TerminalDevice';

class TerminalDevicesRepository implements ITerminalDevicesRepository {
  private ormRepository: Repository<TerminalDevice>;

  constructor() {
    this.ormRepository = dataSource.getRepository(TerminalDevice);
  }

  public async create(data: ICreateTerminalDeviceDTO): Promise<TerminalDevice> {
    const device = this.ormRepository.create({ ...data, active: true });

    return this.ormRepository.save(device);
  }

  public async save(device: TerminalDevice): Promise<TerminalDevice> {
    return this.ormRepository.save(device);
  }

  public async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  public async findById(id: string): Promise<TerminalDevice | undefined> {
    // Sem id o TypeORM 0.3 ignoraria o filtro e traria o primeiro registro
    if (!id) return undefined;

    return (await this.ormRepository.findOneBy({ id })) ?? undefined;
  }

  public async findByProvider(provider: string): Promise<TerminalDevice[]> {
    return this.ormRepository.find({
      where: { provider },
      order: { name: 'ASC' },
    });
  }
}

export default TerminalDevicesRepository;
