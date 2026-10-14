import { Injectable, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { StorageEnginePort, StoragePersistResult } from '../ports/storage-engine.port';

/**
 * 生产/本地默认存储引擎适配器 (LocalStorageEngineAdapter)
 * 本地物理磁盘零依赖持久化，开箱即用，无需配置外部云服务
 */
@Injectable()
export class LocalStorageEngineAdapter implements StorageEnginePort {
  private readonly baseDir: string;
  private readonly urlPrefix: string;

  constructor(
    @Optional() baseDir?: string,
    @Optional() urlPrefix?: string
  ) {
    this.baseDir = baseDir || process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
    const prefix = urlPrefix || '/uploads/';
    this.urlPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
  }

  async write(relativePath: string, buffer: Buffer): Promise<StoragePersistResult> {
    const cleanRelativePath = relativePath.replace(/^[/\\]+/, '');
    const fullPath = path.join(this.baseDir, cleanRelativePath);
    const dir = path.dirname(fullPath);

    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);

    return {
      relativePath: cleanRelativePath,
      url: this.resolveUrl(cleanRelativePath),
      absolutePath: fullPath,
      sizeBytes: buffer.length,
    };
  }

  async exists(relativePath: string): Promise<boolean> {
    const cleanRelativePath = relativePath.replace(/^[/\\]+/, '');
    const fullPath = path.join(this.baseDir, cleanRelativePath);
    try {
      await fs.promises.access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async delete(relativePath: string): Promise<boolean> {
    const cleanRelativePath = relativePath.replace(/^[/\\]+/, '');
    const fullPath = path.join(this.baseDir, cleanRelativePath);
    try {
      await fs.promises.unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const cleanPrefix = prefix.replace(/^[/\\]+/, '');
    const targetDirOrFile = path.join(this.baseDir, cleanPrefix);
    let deletedCount = 0;

    try {
      const stat = await fs.promises.stat(targetDirOrFile);
      if (stat.isDirectory()) {
        const files = await fs.promises.readdir(targetDirOrFile, { recursive: true });
        deletedCount = files.length;
        await fs.promises.rm(targetDirOrFile, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(targetDirOrFile);
        deletedCount = 1;
      }
    } catch {
      // 路径不存在或已被删除
    }

    return deletedCount;
  }

  resolveUrl(relativePath: string): string {
    const cleanPath = relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    return `${this.urlPrefix}${cleanPath}`;
  }
}
