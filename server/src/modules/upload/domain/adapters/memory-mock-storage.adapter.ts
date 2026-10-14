import { Injectable, Optional } from '@nestjs/common';
import { StorageEnginePort, StoragePersistResult } from '../ports/storage-engine.port';

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

  async write(relativePath: string, buffer: Buffer): Promise<StoragePersistResult> {
    const cleanKey = relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    this.files.set(cleanKey, Buffer.from(buffer));
    return {
      relativePath: cleanKey,
      url: this.resolveUrl(cleanKey),
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

  resolveUrl(relativePath: string): string {
    const cleanPath = relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    return `${this.urlPrefix}${cleanPath}`;
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
