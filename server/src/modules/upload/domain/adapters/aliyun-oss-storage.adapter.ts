import { Injectable, Optional } from '@nestjs/common';
import * as path from 'path';
import OSS = require('ali-oss');
import { SignedUrlOptions, StorageEnginePort, StoragePersistResult } from '../ports/storage-engine.port';

export interface AliyunOssConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  /** 已绑定 Bucket 的自定义域名 (如 media.example.com)，签名链接使用该域名 */
  customDomain?: string;
  /** 服务器同样部署在阿里云同地域时走内网上传，节省流量费 */
  internal?: boolean;
}

/** 写入 / 签名两类操作所需的最小客户端能力 (便于单测注入桩) */
export type OssClientLike = Pick<OSS, 'put' | 'head' | 'delete' | 'deleteMulti' | 'list' | 'signatureUrl'>;

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.3gp': 'video/3gpp',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|avi|3gp)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

/** 九宫格方形缩略图 / 视频首帧封面 (OSS 数据处理参数，随签名一起生效) */
const IMAGE_THUMB_PROCESS = 'image/resize,m_fill,w_300,h_300/quality,q_80';
const VIDEO_THUMB_PROCESS = 'video/snapshot,t_1000,f_jpg,w_300,h_300,m_fast';

export function readAliyunOssConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AliyunOssConfig {
  const required = ['OSS_REGION', 'OSS_BUCKET', 'OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET'] as const;
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`STORAGE_ENGINE=oss 时必须配置: ${missing.join(', ')}`);
  }
  return {
    region: env.OSS_REGION!.trim(),
    bucket: env.OSS_BUCKET!.trim(),
    accessKeyId: env.OSS_ACCESS_KEY_ID!.trim(),
    accessKeySecret: env.OSS_ACCESS_KEY_SECRET!.trim(),
    customDomain: env.OSS_CUSTOM_DOMAIN?.trim() || undefined,
    internal: env.OSS_INTERNAL === 'true',
  };
}

/**
 * 阿里云 OSS 存储引擎适配器 (AliyunOssStorageAdapter)
 * Bucket 保持私有读写：对外只输出限时预签名链接，缩略图由 OSS 图片/视频处理参数实时生成。
 * resolveUrl 仍返回 /uploads/<key> 形式，保证数据库中的历史值可被 toStorageKey 还原；
 * 接口出参由 MediaLinkInterceptor 统一换成签名地址，/uploads/ 本身不对外提供访问。
 */
@Injectable()
export class AliyunOssStorageAdapter implements StorageEnginePort {
  private readonly writeClient: OssClientLike;
  private readonly signClient: OssClientLike;
  private signHostCache: string | null | undefined;

  constructor(
    @Optional() config?: AliyunOssConfig,
    @Optional() clients?: { write: OssClientLike; sign: OssClientLike },
  ) {
    if (clients) {
      this.writeClient = clients.write;
      this.signClient = clients.sign;
      return;
    }
    const cfg = config || readAliyunOssConfigFromEnv();
    const base = {
      region: cfg.region,
      bucket: cfg.bucket,
      accessKeyId: cfg.accessKeyId,
      accessKeySecret: cfg.accessKeySecret,
      secure: true,
    };
    this.writeClient = new OSS({ ...base, internal: !!cfg.internal });
    // 签名链接给家长手机访问：必须走公网 (或自定义域名)，不能用内网域名
    this.signClient = cfg.customDomain
      ? new OSS({ ...base, endpoint: cfg.customDomain, cname: true })
      : new OSS(base);
  }

  async write(relativePath: string, buffer: Buffer, baseUrl?: string): Promise<StoragePersistResult> {
    const key = this.cleanKey(relativePath);
    await this.writeClient.put(key, buffer, {
      mime: CONTENT_TYPES[path.extname(key).toLowerCase()] || 'application/octet-stream',
      headers: { 'x-oss-object-acl': 'private' },
    });
    return {
      relativePath: key,
      url: this.resolveUrl(key, baseUrl),
      sizeBytes: buffer.length,
    };
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await this.writeClient.head(this.cleanKey(relativePath));
      return true;
    } catch (err) {
      if (this.isNotFound(err)) return false;
      throw err;
    }
  }

  async delete(relativePath: string): Promise<boolean> {
    const key = this.cleanKey(relativePath);
    if (!(await this.exists(key))) return false;
    await this.writeClient.delete(key);
    return true;
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const cleanPrefix = this.cleanKey(prefix);
    // 防止空前缀误删整个 Bucket
    if (!cleanPrefix) return 0;

    let deletedCount = 0;
    let marker: string | undefined;
    do {
      const page = await this.writeClient.list({ prefix: cleanPrefix, marker, 'max-keys': 1000 }, {});
      const names = (page.objects || []).map((o) => o.name);
      if (names.length > 0) {
        await this.writeClient.deleteMulti(names, { quiet: true });
        deletedCount += names.length;
      }
      marker = page.isTruncated ? page.nextMarker : undefined;
    } while (marker);

    return deletedCount;
  }

  resolveUrl(relativePath: string, baseUrl?: string): string {
    const relativeUrl = `/uploads/${this.cleanKey(relativePath)}`;
    const base = baseUrl || process.env.APP_BASE_URL;
    return base ? `${base.replace(/\/+$/, '')}${relativeUrl}` : relativeUrl;
  }

  signedUrl(key: string, options: SignedUrlOptions = {}): string {
    const cleanKey = this.cleanKey(key);
    const process = options.variant === 'thumb' ? this.thumbProcess(cleanKey) : undefined;
    return this.signClient.signatureUrl(cleanKey, {
      expires: options.expiresInSeconds ?? 3600,
      ...(process ? { process } : {}),
    });
  }

  keyFromSignedUrl(url: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.host !== this.signHost()) return null;
    const signed = parsed.searchParams.has('Signature') || parsed.searchParams.has('x-oss-signature');
    if (!signed) return null;
    try {
      return this.cleanKey(decodeURIComponent(parsed.pathname)) || null;
    } catch {
      return null;
    }
  }

  /** 签名链接所用域名 (Bucket 公网域名或自定义域名)，以签名客户端实际输出为准 */
  private signHost(): string {
    if (this.signHostCache === undefined) {
      try {
        this.signHostCache = new URL(this.signClient.signatureUrl('probe', { expires: 60 })).host;
      } catch {
        this.signHostCache = null;
      }
    }
    return this.signHostCache ?? '';
  }

  private thumbProcess(key: string): string | undefined {
    if (IMAGE_EXT.test(key)) return IMAGE_THUMB_PROCESS;
    if (VIDEO_EXT.test(key)) return VIDEO_THUMB_PROCESS;
    return undefined;
  }

  private cleanKey(relativePath: string): string {
    return relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
  }

  private isNotFound(err: unknown): boolean {
    const e = err as { status?: number; code?: string };
    return e?.status === 404 || e?.code === 'NoSuchKey';
  }
}
