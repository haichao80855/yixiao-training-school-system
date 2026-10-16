import type { DraftStoragePort } from '../ports';

export class UniStorageDraftAdapter implements DraftStoragePort {
  getDraft<T = any>(key: string): T | null {
    try {
      if (typeof uni !== 'undefined' && uni.getStorageSync) {
        const val = uni.getStorageSync(key);
        if (!val) return null;
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            return val as any;
          }
        }
        return val;
      }
    } catch (e) {
      console.warn('[UniStorageDraftAdapter] getDraft error:', e);
    }
    return null;
  }

  setDraft<T = any>(key: string, value: T): void {
    try {
      if (typeof uni !== 'undefined' && uni.setStorageSync) {
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        uni.setStorageSync(key, str);
      }
    } catch (e) {
      console.warn('[UniStorageDraftAdapter] setDraft error:', e);
    }
  }

  removeDraft(key: string): void {
    try {
      if (typeof uni !== 'undefined' && uni.removeStorageSync) {
        uni.removeStorageSync(key);
      }
    } catch (e) {
      console.warn('[UniStorageDraftAdapter] removeDraft error:', e);
    }
  }
}
