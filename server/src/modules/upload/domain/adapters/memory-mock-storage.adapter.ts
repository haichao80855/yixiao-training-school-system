import { Injectable, Optional } from '@nestjs/common';
import { SignedUrlOptions, StorageEnginePort, StoragePersistResult } from '../ports/storage-engine.port';

/**
 * 单元测试专用内存存储桩 (MemoryMockStorageAdapter)
 * 全内存 Map 结构，杜绝物理磁盘污染与外部网络依赖，保障单测 0 I/O、毫秒级执行
 */
@Injectable()
export class MemoryMockStorageAdapter implements StorageEnginePort {
  private readonly files = new Map<string, Buffer>();
  private readonly urlPrefix: string;

  constructor(@Optional() urlPrefix?: string) {
    const prefix = urlPrefix || '/uploads/';
    this.urlPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
  }

  async write(relativePath: string, buffer: Buffer, baseUrl?: string): Promise<StoragePersistResult> {
    const cleanKey = relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    this.files.set(cleanKey, Buffer.from(buffer));
    return {
      relativePath: cleanKey,
      url: this.resolveUrl(cleanKey, baseUrl),
      absolutePath: `memory://${cleanKey}`,
      sizeBytes: buffer.length,
    };
  }

  async exists(relativePath: string): Promise<boolean> {
    const cleanKey = relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    return this.files.has(cleanKey);
  }

  async delete(relativePath: string): Promise<boolean> {
    const cleanKey = relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    return this.files.delete(cleanKey);
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const cleanPrefix = prefix.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    let deletedCount = 0;
    for (const key of Array.from(this.files.keys())) {
      if (key.startsWith(cleanPrefix)) {
        this.files.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  resolveUrl(relativePath: string, baseUrl?: string): string {
    const cleanPath = relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    const relativeUrl = `${this.urlPrefix}${cleanPath}`;
    const base = baseUrl || process.env.CDN_PUBLIC_BASE_URL || process.env.APP_BASE_URL;
    if (base) {
      const cleanBase = base.replace(/\/+$/, '');
      return `${cleanBase}${relativeUrl}`;
    }
    return relativeUrl;
  }


  signedUrl(key: string, options: SignedUrlOptions = {}): string {
    const exp = Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 3600);
    return `/api/media/${key}?exp=${exp}&sig=memory`;
  }

  // 供单测断言使用的辅助方法
  getBuffer(relativePath: string): Buffer | undefined {
    const cleanKey = relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    return this.files.get(cleanKey);
  }

  clear(): void {
    this.files.clear();
  }
}
