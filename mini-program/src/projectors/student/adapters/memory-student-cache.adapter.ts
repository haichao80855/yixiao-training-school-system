import type { StudentCachePort } from '../ports';

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

/**
 * 内存缓存适配器 (In-Memory Student Cache Adapter)
 * 提供轻量级 TTL 自动失效与手动淘汰能力
 */
export class MemoryStudentCacheAdapter implements StudentCachePort {
  private cache = new Map<string, CacheEntry<any>>();

  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return JSON.parse(JSON.stringify(entry.value)) as T;
  }

  set<T = any>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
    this.cache.set(key, {
      value: JSON.parse(JSON.stringify(value)),
      expiresAt,
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
