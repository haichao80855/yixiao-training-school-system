// =======================================================
// 拓视未来教育「一校教培系统」业务参数字典高性能缓存管理器 (DictCacheManager)
// 具备内存 TTL 控制、双向分类与键值索引、并发单飞防击穿、写穿自驱失效机制
// =======================================================

export interface DictCacheItem {
  id: string;
  category: string;
  dictKey: string;
  label: string;
  order: number;
  enabled: boolean;
  remark?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CacheEntry {
  items: DictCacheItem[];
  expireAt: number;
}

export class DictCacheManager {
  private static instance: DictCacheManager;

  // 默认缓存存活时间: 15 分钟
  private readonly defaultTtlMs = 15 * 60 * 1000;

  // 按 category 划分的列表缓存
  private categoryCache = new Map<string, CacheEntry>();

  // 全量字典缓存
  private allCache: CacheEntry | null = null;

  // 快速点查索引 `${category}:${dictKey}` -> DictCacheItem
  private keyIndex = new Map<string, DictCacheItem>();

  // 并发请求防击穿互斥锁 (Single Flight)
  private inFlightRequests = new Map<string, Promise<DictCacheItem[]>>();

  // 性能与可观测性统计
  private stats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
  };

  private constructor() {}

  static getInstance(): DictCacheManager {
    if (!DictCacheManager.instance) {
      DictCacheManager.instance = new DictCacheManager();
    }
    return DictCacheManager.instance;
  }

  /**
   * 获取指定分类或全量的字典项（优先从缓存命中）
   * @param category 分类标识，若不传则获取全量字典
   * @param fetchFromDb 当缓存未命中时的回源查询函数
   */
  async get(
    category: string | undefined,
    fetchFromDb: () => Promise<DictCacheItem[]>,
  ): Promise<DictCacheItem[]> {
    const now = Date.now();
    const cacheKey = category || '__ALL__';

    // 1. 检查全量或分类缓存是否有效
    if (category) {
      const entry = this.categoryCache.get(category);
      if (entry && entry.expireAt > now) {
        this.stats.hits++;
        return entry.items;
      }
    } else {
      if (this.allCache && this.allCache.expireAt > now) {
        this.stats.hits++;
        return this.allCache.items;
      }
    }

    // 2. 缓存未命中，检查是否已有同名正在发起的查询 (Single-Flight 防击穿)
    this.stats.misses++;
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const items = await fetchFromDb();
        const expireAt = Date.now() + this.defaultTtlMs;

        if (category) {
          this.categoryCache.set(category, { items, expireAt });
          // 更新 keyIndex 索引
          for (const item of items) {
            this.keyIndex.set(`${item.category}:${item.dictKey}`, item);
          }
        } else {
          this.allCache = { items, expireAt };
          // 重建全量索引
          this.keyIndex.clear();
          for (const item of items) {
            this.keyIndex.set(`${item.category}:${item.dictKey}`, item);
          }
        }

        return items;
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * 极速 O(1) 点查指定分类与键值的字典项
   */
  getByKey(category: string, dictKey: string): DictCacheItem | undefined {
    return this.keyIndex.get(`${category}:${dictKey}`);
  }

  /**
   * 自驱缓存失效：当字典发生增、删、改、状态切换时调用
   * @param category 受影响的字典分类标识，若不传则清空全量
   */
  invalidate(category?: string): void {
    this.stats.invalidations++;
    this.allCache = null; // 全量缓存必须失效

    if (category) {
      this.categoryCache.delete(category);
      // 清除索引中对应 category 的条目
      for (const [key] of this.keyIndex) {
        if (key.startsWith(`${category}:`)) {
          this.keyIndex.delete(key);
        }
      }
    } else {
      this.categoryCache.clear();
      this.keyIndex.clear();
    }
  }

  /**
   * 获取缓存运行性能统计指标
   */
  getStats() {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate:
        this.stats.hits + this.stats.misses === 0
          ? '0%'
          : `${((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1)}%`,
      invalidations: this.stats.invalidations,
      cachedCategories: this.categoryCache.size,
      indexedKeysCount: this.keyIndex.size,
    };
  }
}
