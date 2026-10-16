import type {
  GrowthQueryPort,
  GrowthCachePort,
  RawParentSingleLessonDto,
  RawWorkbenchDto,
} from '../ports';

interface CacheItem<T> {
  data: T;
  expireAt: number;
}

export class MemoryGrowthCacheAdapter implements GrowthCachePort {
  private map = new Map<string, CacheItem<any>>();

  get<T>(key: string): T | null {
    const item = this.map.get(key);
    if (!item) return null;
    if (Date.now() > item.expireAt) {
      this.map.delete(key);
      return null;
    }
    return item.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number = 3 * 60 * 1000): void {
    this.map.set(key, {
      data,
      expireAt: Date.now() + ttlMs,
    });
  }

  remove(key: string): void {
    this.map.delete(key);
  }

  clearByPrefix(prefix: string): void {
    for (const k of Array.from(this.map.keys())) {
      if (k.startsWith(prefix)) {
        this.map.delete(k);
      }
    }
  }
}

export class UniStorageGrowthCacheAdapter implements GrowthCachePort {
  private memoryFallback = new Map<string, CacheItem<any>>();

  private get isUniAvailable(): boolean {
    return typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function';
  }

  get<T>(key: string): T | null {
    try {
      let raw: any = null;
      if (this.isUniAvailable) {
        raw = uni.getStorageSync(key);
      } else {
        raw = this.memoryFallback.get(key) || null;
      }

      if (!raw) return null;

      let item: CacheItem<T>;
      if (typeof raw === 'string') {
        try {
          item = JSON.parse(raw);
        } catch {
          return null;
        }
      } else {
        item = raw as CacheItem<T>;
      }

      if (!item || typeof item.expireAt !== 'number') return null;
      if (Date.now() > item.expireAt) {
        this.remove(key);
        return null;
      }
      return item.data;
    } catch {
      return null;
    }
  }

  set<T>(key: string, data: T, ttlMs: number = 3 * 60 * 1000): void {
    const item: CacheItem<T> = {
      data,
      expireAt: Date.now() + ttlMs,
    };
    try {
      if (this.isUniAvailable) {
        uni.setStorageSync(key, JSON.stringify(item));
      } else {
        this.memoryFallback.set(key, item);
      }
    } catch {
      this.memoryFallback.set(key, item);
    }
  }

  remove(key: string): void {
    try {
      if (this.isUniAvailable) {
        uni.removeStorageSync(key);
      }
      this.memoryFallback.delete(key);
    } catch {
      this.memoryFallback.delete(key);
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
    } catch {}

    for (const k of Array.from(this.memoryFallback.keys())) {
      if (k.startsWith(prefix)) {
        this.memoryFallback.delete(k);
      }
    }
  }
}

export class MemoryGrowthQueryAdapter implements GrowthQueryPort {
  private parentLessons = new Map<string, RawParentSingleLessonDto>();
  private workbenches = new Map<string, RawWorkbenchDto>();

  setMockParentLesson(scheduleId: string, data: RawParentSingleLessonDto): void {
    this.parentLessons.set(scheduleId, data);
  }

  setMockWorkbench(scheduleId: string, data: RawWorkbenchDto): void {
    this.workbenches.set(scheduleId, data);
  }

  async fetchParentSingleLesson(scheduleId: string, token?: string): Promise<RawParentSingleLessonDto | null> {
    return this.parentLessons.get(scheduleId) || null;
  }

  async fetchScheduleWorkbench(scheduleId: string): Promise<RawWorkbenchDto> {
    const wb = this.workbenches.get(scheduleId);
    if (!wb) {
      throw new Error(`Schedule ${scheduleId} not found in mock workbench`);
    }
    return wb;
  }
}
