import { Injectable } from '@nestjs/common';
import { StorageEnginePort } from '../upload/domain/ports/storage-engine.port';
import { isExternalUrl, parseMediaList, toStorageKey } from '../upload/domain/media-key.util';

const LINK_TTL_SECONDS = 3600;
/** 照片和封面的链接 6 小时内不变，手机才能命中缓存，反复进出页面不重复下载 */
const IMAGE_LINK_STABLE_SECONDS = 6 * 3600;

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
    const url = this.sign(stored, 'preview', IMAGE_LINK_STABLE_SECONDS);
    if (!url) return null;
    return { url, thumbUrl: this.sign(stored, 'thumb', IMAGE_LINK_STABLE_SECONDS) || url };
  }

  /** 视频：播放链接保持 1 小时有效，只有封面走缓存 */
  video(stored: string): PhotoLink | null {
    const url = this.sign(stored, 'original');
    if (!url) return null;
    return { url, thumbUrl: this.sign(stored, 'thumb', IMAGE_LINK_STABLE_SECONDS) || url };
  }

  photos(raw: string | null | undefined): PhotoLink[] {
    return parseMediaList(raw)
      .map((v) => this.photo(v))
      .filter((p): p is PhotoLink => p !== null);
  }

  file(stored: string | null | undefined): string | null {
    return stored ? this.sign(stored, 'original') : null;
  }

  private sign(stored: string, variant: 'original' | 'thumb' | 'preview', stableForSeconds?: number): string | null {
    if (!stored || !stored.trim()) return null;
    const key = toStorageKey(stored);
    // 第三方外链 (历史演示数据) 原样返回
    if (isExternalUrl(key)) return key;
    return this.storage.signedUrl(key, { variant, expiresInSeconds: LINK_TTL_SECONDS, stableForSeconds });
  }
}
