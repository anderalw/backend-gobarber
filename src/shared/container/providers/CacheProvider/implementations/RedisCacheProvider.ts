import Redis, { Redis as RedisClient } from 'ioredis';
import cacheConfig from '@config/cache';
import { currentTenant } from '@shared/tenancy/TenantContext';
import ICacheProvider from '../models/ICacheProvider';

// Cada barbearia tem as próprias chaves (o Redis é de todas)
function scoped(key: string): string {
  const tenant = currentTenant();

  return tenant ? `t:${tenant.id}:${key}` : key;
}

export default class RedisCacheProvider implements ICacheProvider {
  private client: RedisClient;

  constructor() {
    this.client = new Redis(cacheConfig.config.redis);
  }

  public async save(key: string, value: unknown): Promise<void> {
    await this.client.set(scoped(key), JSON.stringify(value));
  }

  public async recover<T>(key: string): Promise<T | null> {
    const data = await this.client.get(scoped(key));

    if (!data) {
      return null;
    }
    const parsedData = JSON.parse(data) as T;

    return parsedData;
  }

  public async invalidate(key: string): Promise<void> {
    await this.client.del(scoped(key));
  }

  public async invalidatePrefix(prefix: string): Promise<void> {
    const keys = await this.client.keys(`${scoped(prefix)}:*`);

    const pipeline = this.client.pipeline();

    keys.forEach(key => {
      pipeline.del(key);
    });

    await pipeline.exec();
  }
}
