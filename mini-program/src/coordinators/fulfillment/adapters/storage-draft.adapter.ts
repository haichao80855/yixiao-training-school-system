import type { DraftStoragePort, DraftScope, DraftStorageOptions } from '../ports';

export interface DraftEnvelope<T> {
  v: number;       // 封套协议版本 1
  ts: number;      // 写入时间戳
  exp: number;     // 过期时间戳
  scope?: DraftScope;
  data: T;
}

export interface DraftIndexEntry {
  key: string;
  scheduleId: string;
  studentId?: string;
  campusId: string;
  lastAccessed: number;
  expireAt: number;
}

const DEFAULT_TTL_MS = 7 * 24 * 3600 * 1000; // 默认 7 天生命周期
const INDEX_STORAGE_KEY = 'yx:draft_index';

export function resolveDraftStorageKey(scopeOrKey: DraftScope | string): string {
  if (typeof scopeOrKey === 'string') {
    return scopeOrKey;
  }
  const campus = scopeOrKey.campusId || 'default';
  const schedule = scopeOrKey.scheduleId;
  const student = scopeOrKey.studentId || '__class__';
  return `yx:draft:v1:${campus}:${schedule}:${student}`;
}

export class UniStorageDraftAdapter implements DraftStoragePort {
  private fallbackMemoryMap = new Map<string, string>();
  private fallbackIndex = new Map<string, DraftIndexEntry>();
  private injectedUni?: any;

  constructor(injectedUni?: any) {
    this.injectedUni = injectedUni;
  }

  private get uniApi(): any {
    if (this.injectedUni) return this.injectedUni;
    if (typeof uni !== 'undefined') return uni;
    return null;
  }

  private get isUniAvailable(): boolean {
    const api = this.uniApi;
    return Boolean(api && typeof api.getStorageSync === 'function');
  }

  getDraft<T = any>(scopeOrKey: DraftScope | string): T | null {
    const key = resolveDraftStorageKey(scopeOrKey);
    try {
      let rawStr: string | null = null;
      if (this.isUniAvailable) {
        rawStr = this.uniApi.getStorageSync(key);
      } else {
        rawStr = this.fallbackMemoryMap.get(key) || null;
      }

      if (!rawStr) return null;

      let parsed: any;
      if (typeof rawStr === 'string') {
        try {
          parsed = JSON.parse(rawStr);
        } catch {
          // 损坏脏数据，静默清理并阻断白屏
          this.removeDraft(key);
          return null;
        }
      } else {
        parsed = rawStr;
      }

      // 1. 检查是否为封套数据
      if (parsed && typeof parsed === 'object' && parsed.v === 1 && typeof parsed.exp === 'number') {
        const envelope = parsed as DraftEnvelope<T>;
        // 2. TTL 过期判定：已过期则懒删除
        if (Date.now() > envelope.exp) {
          this.removeDraft(key);
          return null;
        }
        this.updateAccessTime(key);
        return envelope.data;
      }

      // 3. 兼容旧式非封套裸数据
      return parsed as T;
    } catch (e) {
      console.warn('[UniStorageDraftAdapter] getDraft error:', e);
      return null;
    }
  }

  setDraft<T = any>(scopeOrKey: DraftScope | string, value: T, options?: DraftStorageOptions): void {
    const key = resolveDraftStorageKey(scopeOrKey);
    const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    const now = Date.now();

    const envelope: DraftEnvelope<T> = {
      v: 1,
      ts: now,
      exp: now + ttlMs,
      scope: typeof scopeOrKey === 'object' ? scopeOrKey : undefined,
      data: value,
    };

    const str = JSON.stringify(envelope);

    try {
      if (this.isUniAvailable) {
        try {
          this.uniApi.setStorageSync(key, str);
        } catch (storageErr: any) {
          // 捕获微信 10MB 配额溢出异常，自动执行 LRU 紧缩后重试
          console.warn('[UniStorageDraftAdapter] 存储空间预警，启动 LRU 自动紧缩沙箱:', storageErr);
          this.compact();
          this.uniApi.setStorageSync(key, str);
        }
      } else {
        this.fallbackMemoryMap.set(key, str);
      }

      // 记录/更新草稿索引
      this.recordIndexEntry(key, scopeOrKey, now, now + ttlMs);
    } catch (e) {
      console.warn('[UniStorageDraftAdapter] setDraft error:', e);
      // 容错降级至内存
      this.fallbackMemoryMap.set(key, str);
    }
  }

  removeDraft(scopeOrKey: DraftScope | string): void {
    const key = resolveDraftStorageKey(scopeOrKey);
    try {
      if (this.isUniAvailable) {
        this.uniApi.removeStorageSync(key);
      }
      this.fallbackMemoryMap.delete(key);
      this.removeIndexEntry(key);
    } catch (e) {
      this.fallbackMemoryMap.delete(key);
      this.removeIndexEntry(key);
    }
  }

  purgeScheduleDrafts(scheduleId: string, campusId?: string): number {
    let purgedCount = 0;
    const index = this.loadIndex();
    const keysToRemove: string[] = [];

    // 1. 从索引表中精确提取匹配项
    for (const [key, entry] of index.entries()) {
      if (entry.scheduleId === scheduleId) {
        if (!campusId || entry.campusId === campusId) {
          keysToRemove.push(key);
        }
      }
    }

    // 2. 针对无索引的历史遗留键执行模式兜底匹配
    if (this.isUniAvailable && typeof this.uniApi.getStorageInfoSync === 'function') {
      try {
        const info = this.uniApi.getStorageInfoSync();
        if (info && Array.isArray(info.keys)) {
          const v1Prefix = `yx:draft:v1:${campusId || ''}`;
          const legacyPrefix = `eval_draft_${scheduleId}`;
          for (const k of info.keys) {
            if (
              (k.startsWith('yx:draft:v1:') && k.includes(`:${scheduleId}:`)) ||
              k.startsWith(legacyPrefix)
            ) {
              if (!keysToRemove.includes(k)) {
                keysToRemove.push(k);
              }
            }
          }
        }
      } catch {}
    }

    // 亦扫描内存回退表
    for (const k of Array.from(this.fallbackMemoryMap.keys())) {
      if (
        (k.startsWith('yx:draft:v1:') && k.includes(`:${scheduleId}:`)) ||
        k.startsWith(`eval_draft_${scheduleId}`)
      ) {
        if (!keysToRemove.includes(k)) {
          keysToRemove.push(k);
        }
      }
    }

    // 3. 物理执行一键清空
    for (const key of keysToRemove) {
      this.removeDraft(key);
      purgedCount++;
    }

    return purgedCount;
  }

  compact(): { reclaimedKeys: number; freedBytes: number } {
    let reclaimedKeys = 0;
    let freedBytes = 0;
    const now = Date.now();
    const index = this.loadIndex();

    // 阶段 1: 清理所有已超时的过期草稿
    const expiredKeys: string[] = [];
    for (const [key, entry] of index.entries()) {
      if (now > entry.expireAt) {
        expiredKeys.push(key);
      }
    }

    for (const k of expiredKeys) {
      this.removeDraft(k);
      reclaimedKeys++;
      freedBytes += 1024;
    }

    // 阶段 2: 若仍有较多草稿，按 LRU 最久未访问淘汰前 20%
    const remainingEntries = Array.from(index.values()).filter(e => !expiredKeys.includes(e.key));
    if (remainingEntries.length > 10) {
      remainingEntries.sort((a, b) => a.lastAccessed - b.lastAccessed);
      const evictTargetCount = Math.ceil(remainingEntries.length * 0.2);
      for (let i = 0; i < evictTargetCount; i++) {
        this.removeDraft(remainingEntries[i].key);
        reclaimedKeys++;
        freedBytes += 2048;
      }
    }

    return { reclaimedKeys, freedBytes };
  }

  private loadIndex(): Map<string, DraftIndexEntry> {
    if (!this.isUniAvailable) {
      return this.fallbackIndex;
    }
    try {
      const raw = this.uniApi.getStorageSync(INDEX_STORAGE_KEY);
      if (raw) {
        const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return new Map(Object.entries(obj));
      }
    } catch {}
    return new Map();
  }

  private saveIndex(map: Map<string, DraftIndexEntry>): void {
    if (!this.isUniAvailable) {
      this.fallbackIndex = map;
      return;
    }
    try {
      const obj = Object.fromEntries(map.entries());
      this.uniApi.setStorageSync(INDEX_STORAGE_KEY, JSON.stringify(obj));
    } catch {}
  }

  private recordIndexEntry(key: string, scopeOrKey: DraftScope | string, now: number, expireAt: number): void {
    const index = this.loadIndex();
    let scheduleId = '';
    let studentId: string | undefined;
    let campusId = 'default';

    if (typeof scopeOrKey === 'object') {
      scheduleId = scopeOrKey.scheduleId;
      studentId = scopeOrKey.studentId;
      campusId = scopeOrKey.campusId || 'default';
    } else {
      // 尝试解析旧格式 eval_draft_${scheduleId}_${studentId}
      const parts = scopeOrKey.split('_');
      if (parts.length >= 3 && parts[0] === 'eval' && parts[1] === 'draft') {
        scheduleId = parts[2];
        studentId = parts[3];
      }
    }

    index.set(key, {
      key,
      scheduleId,
      studentId,
      campusId,
      lastAccessed: now,
      expireAt,
    });
    this.saveIndex(index);
  }

  private updateAccessTime(key: string): void {
    const index = this.loadIndex();
    const entry = index.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      index.set(key, entry);
      this.saveIndex(index);
    }
  }

  private removeIndexEntry(key: string): void {
    const index = this.loadIndex();
    if (index.delete(key)) {
      this.saveIndex(index);
    }
  }
}

export class MemoryDraftStorageAdapter implements DraftStoragePort {
  private store = new Map<string, string>();
  private index = new Map<string, DraftIndexEntry>();

  getDraft<T = any>(scopeOrKey: DraftScope | string): T | null {
    const key = resolveDraftStorageKey(scopeOrKey);
    const raw = this.store.get(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.v === 1 && typeof parsed.exp === 'number') {
        if (Date.now() > parsed.exp) {
          this.removeDraft(key);
          return null;
        }
        return parsed.data as T;
      }
      return parsed as T;
    } catch {
      this.removeDraft(key);
      return null;
    }
  }

  setDraft<T = any>(scopeOrKey: DraftScope | string, value: T, options?: DraftStorageOptions): void {
    const key = resolveDraftStorageKey(scopeOrKey);
    const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    const now = Date.now();

    const envelope: DraftEnvelope<T> = {
      v: 1,
      ts: now,
      exp: now + ttlMs,
      scope: typeof scopeOrKey === 'object' ? scopeOrKey : undefined,
      data: value,
    };

    this.store.set(key, JSON.stringify(envelope));

    let scheduleId = '';
    let studentId: string | undefined;
    let campusId = 'default';
    if (typeof scopeOrKey === 'object') {
      scheduleId = scopeOrKey.scheduleId;
      studentId = scopeOrKey.studentId;
      campusId = scopeOrKey.campusId || 'default';
    }

    this.index.set(key, {
      key,
      scheduleId,
      studentId,
      campusId,
      lastAccessed: now,
      expireAt: now + ttlMs,
    });
  }

  removeDraft(scopeOrKey: DraftScope | string): void {
    const key = resolveDraftStorageKey(scopeOrKey);
    this.store.delete(key);
    this.index.delete(key);
  }

  purgeScheduleDrafts(scheduleId: string, campusId?: string): number {
    let purged = 0;
    const keysToRemove: string[] = [];

    for (const [key, entry] of this.index.entries()) {
      if (entry.scheduleId === scheduleId) {
        if (!campusId || entry.campusId === campusId) {
          keysToRemove.push(key);
        }
      }
    }

    // 兼容历史前缀
    for (const k of Array.from(this.store.keys())) {
      if (
        (k.startsWith('yx:draft:v1:') && k.includes(`:${scheduleId}:`)) ||
        k.startsWith(`eval_draft_${scheduleId}`)
      ) {
        if (!keysToRemove.includes(k)) {
          keysToRemove.push(k);
        }
      }
    }

    for (const k of keysToRemove) {
      this.removeDraft(k);
      purged++;
    }

    return purged;
  }

  compact(): { reclaimedKeys: number; freedBytes: number } {
    let reclaimed = 0;
    const now = Date.now();
    for (const [key, entry] of Array.from(this.index.entries())) {
      if (now > entry.expireAt) {
        this.removeDraft(key);
        reclaimed++;
      }
    }
    return { reclaimedKeys: reclaimed, freedBytes: reclaimed * 1024 };
  }
}
