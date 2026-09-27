export default interface ISettingsRepository {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}
