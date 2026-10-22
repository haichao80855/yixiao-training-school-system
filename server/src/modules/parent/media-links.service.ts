import { Injectable } from '@nestjs/common';
import { StorageEnginePort } from '../upload/domain/ports/storage-engine.port';
import { isExternalUrl, parseMediaList, toStorageKey } from '../upload/domain/media-key.util';

export interface PhotoLink {
  url: string;
  thumbUrl: string;
}

/**
 * 家长端媒体链接：数据库中的 URL / key 一律转换为限时签名链接，绝不输出原始存储路径。
 */
@Injectable()
export class MediaLinksService {
  constructor(private readonly storage: StorageEnginePort) {}

  photo(stored: string): PhotoLink | null {
    const url = this.sign(stored, 'original');
    if (!url) return null;
    return { url, thumbUrl: this.sign(stored, 'thumb') || url };
  }

  photos(raw: string | null | undefined): PhotoLink[] {
    return parseMediaList(raw)
      .map((v) => this.photo(v))
      .filter((p): p is PhotoLink => p !== null);
  }

  file(stored: string | null | undefined): string | null {
    return stored ? this.sign(stored, 'original') : null;
  }

  private sign(stored: string, variant: 'original' | 'thumb'): string | null {
    if (!stored || !stored.trim()) return null;
    const key = toStorageKey(stored);
    // 第三方外链 (历史演示数据) 原样返回
    if (isExternalUrl(key)) return key;
    return this.storage.signedUrl(key, { variant, expiresInSeconds: 3600 });
  }
}
