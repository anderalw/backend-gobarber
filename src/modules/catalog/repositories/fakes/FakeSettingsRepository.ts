import ISettingsRepository from '@modules/catalog/repositories/ISettingsRepository';

class FakeSettingsRepository implements ISettingsRepository {
  private settings = new Map<string, string>();

  public async get(key: string): Promise<string | undefined> {
    return this.settings.get(key);
  }

  public async set(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }
}

export default FakeSettingsRepository;
