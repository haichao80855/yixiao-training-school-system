import type { RosterCachePort } from '../ports';

interface CacheEnvelope<T> {
  data: T;
  expireAt: number;
}

export class UniStorageRosterCacheAdapter implements RosterCachePort {
  private fallbackMemoryMap = new Map<string, CacheEnvelope<any>>();

  private get isUniAvailable(): boolean {
    return typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function';
  }

  get<T>(key: string): T | null {
    try {
      let raw: string | CacheEnvelope<T> | null = null;
      if (this.isUniAvailable) {
        raw = uni.getStorageSync(key);
      } else {
        raw = this.fallbackMemoryMap.get(key) || null;
      }

      if (!raw) return null;

      let envelope: CacheEnvelope<T>;
      if (typeof raw === 'string') {
        try {
          envelope = JSON.parse(raw);
        } catch {
          return null;
        }
      } else {
        envelope = raw as CacheEnvelope<T>;
      }

      if (!envelope || typeof envelope.expireAt !== 'number') {
        return null;
      }

      if (Date.now() > envelope.expireAt) {
        this.remove(key);
        return null;
      }

      return envelope.data;
    } catch {
      return null;
    }
  }

  set<T>(key: string, data: T, ttlMs: number = 3 * 60 * 1000): void {
    const envelope: CacheEnvelope<T> = {
      data,
      expireAt: Date.now() + ttlMs,
    };

    try {
      if (this.isUniAvailable) {
        uni.setStorageSync(key, JSON.stringify(envelope));
      } else {
        this.fallbackMemoryMap.set(key, envelope);
      }
    } catch {
      // 容错降级
      this.fallbackMemoryMap.set(key, envelope);
    }
  }

  remove(key: string): void {
    try {
      if (this.isUniAvailable) {
        uni.removeStorageSync(key);
      }
      this.fallbackMemoryMap.delete(key);
    } catch {
      this.fallbackMemoryMap.delete(key);
    }
  }

  clearByPrefix(prefix: string): void {
    try {
      if (this.isUniAvailable && typeof uni.getStorageInfoSync === 'function') {
        const info = uni.getStorageInfoSync();
        if (info && Array.isArray(info.keys)) {
          for (const k of info.keys) {
            if (k.startsWith(prefix)) {
              uni.removeStorageSync(k);
            }
          }
        }
      }
    } catch {
      // ignore
    }

    for (const k of Array.from(this.fallbackMemoryMap.keys())) {
      if (k.startsWith(prefix)) {
        this.fallbackMemoryMap.delete(k);
      }
    }
  }
}

export class MemoryRosterCacheAdapter implements RosterCachePort {
  private memoryMap = new Map<string, CacheEnvelope<any>>();

  get<T>(key: string): T | null {
    const envelope = this.memoryMap.get(key);
    if (!envelope) return null;
    if (Date.now() > envelope.expireAt) {
      this.memoryMap.delete(key);
      return null;
    }
    return envelope.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number = 3 * 60 * 1000): void {
    this.memoryMap.set(key, {
      data,
      expireAt: Date.now() + ttlMs,
    });
  }

  remove(key: string): void {
    this.memoryMap.delete(key);
  }

  clearByPrefix(prefix: string): void {
    for (const k of Array.from(this.memoryMap.keys())) {
      if (k.startsWith(prefix)) {
        this.memoryMap.delete(k);
      }
    }
  }
}
