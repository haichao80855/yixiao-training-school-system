import { Injectable, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SignedUrlOptions, StorageEnginePort, StoragePersistResult } from '../ports/storage-engine.port';
import { signMediaKey } from '../media-signer';
import { isSafeStorageKey } from '../media-key.util';

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

  async write(relativePath: string, buffer: Buffer, baseUrl?: string): Promise<StoragePersistResult> {
    const cleanRelativePath = relativePath.replace(/^[/\\]+/, '');
    const fullPath = path.join(this.baseDir, cleanRelativePath);
    const dir = path.dirname(fullPath);

    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);

    return {
      relativePath: cleanRelativePath,
      url: this.resolveUrl(cleanRelativePath, baseUrl),
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
    const sig = signMediaKey(key, exp);
    const base = (process.env.MEDIA_PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    // 本地磁盘暂不生成缩略图：thumb 与原图同一文件 (迁移 OSS 后由图片处理参数生成)
    return `${base}/api/media/${encodedKey}?exp=${exp}&sig=${sig}`;
  }

  /** 本地媒体路由使用：解析 key 对应的磁盘绝对路径 (校验路径穿越) */
  absolutePathFor(key: string): string | null {
    if (!isSafeStorageKey(key)) return null;
    const full = path.resolve(this.baseDir, key);
    const root = path.resolve(this.baseDir) + path.sep;
    return full.startsWith(root) ? full : null;
  }
}
