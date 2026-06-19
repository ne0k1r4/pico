import Redis from "ioredis";
import type { WebsiteProfile } from "./types";

export interface CacheStore {
  get(key: string): Promise<WebsiteProfile | null>;
  set(key: string, value: WebsiteProfile, ttlSeconds: number): Promise<void>;
}

export class RedisCacheStore implements CacheStore {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true
    });
  }

  async get(key: string): Promise<WebsiteProfile | null> {
    const value = await this.redis.get(key);
    return value ? (JSON.parse(value) as WebsiteProfile) : null;
  }

  async set(key: string, value: WebsiteProfile, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }
}

export class MemoryCacheStore implements CacheStore {
  private readonly values = new Map<string, { expiresAt: number; value: WebsiteProfile }>();

  async get(key: string): Promise<WebsiteProfile | null> {
    const item = this.values.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.values.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: WebsiteProfile, ttlSeconds: number): Promise<void> {
    this.values.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }
}
