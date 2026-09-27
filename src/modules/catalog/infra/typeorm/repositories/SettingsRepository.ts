import { getRepository, Repository } from 'typeorm';

import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';
import Setting from '../entities/Setting';

class SettingsRepository implements ISettingsRepository {
  private ormRepository: Repository<Setting>;

  constructor() {
    this.ormRepository = getRepository(Setting);
  }

  public async get(key: string): Promise<string | undefined> {
    const setting = await this.ormRepository.findOne(key);

    return setting?.value;
  }

  public async set(key: string, value: string): Promise<void> {
    // Cria a configuração na primeira vez e atualiza nas seguintes
    await this.ormRepository.save(this.ormRepository.create({ key, value }));
  }
}

export default SettingsRepository;
