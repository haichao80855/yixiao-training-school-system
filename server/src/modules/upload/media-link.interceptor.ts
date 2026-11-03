import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StorageEnginePort } from './domain/ports/storage-engine.port';
import { isOwnUploadRef, isThumbnailRef, toStorageKey, toUploadRef } from './domain/media-key.util';

/** 管理端 / 教师端媒体链接有效期 (秒) */
const STAFF_LINK_TTL_SECONDS = 3600;

/**
 * 媒体链接拦截器 (全局)
 * /uploads/ 不再对外直接提供访问，img / video 标签又无法携带 Authorization 头，因此：
 * - 出参：把接口返回的本系统上传引用 (/uploads/<key>) 换成限时签名链接。
 *   能拿到响应的人已经通过了该接口的登录、权限码与数据范围校验，签名只是把这份授权延伸到媒体文件。
 * - 入参：管理端保存时回传的签名链接还原为 /uploads/<key>，数据库只存与存储介质无关的引用。
 */
@Injectable()
export class MediaLinkInterceptor implements NestInterceptor {
  constructor(private readonly storage: StorageEnginePort) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    if (req.body && typeof req.body === 'object') {
      req.body = this.walk(req.body, (s) => this.restore(s));
    }
    return next.handle().pipe(map((data) => this.walk(data, (s) => this.sign(s))));
  }

  private sign(value: string): string {
    if (!isOwnUploadRef(value)) return value;
    const variant = isThumbnailRef(value) ? 'thumb' : 'original';
    return this.storage.signedUrl(toStorageKey(value), { variant, expiresInSeconds: STAFF_LINK_TTL_SECONDS });
  }

  private restore(value: string): string {
    const key = this.storage.keyFromSignedUrl(value);
    return key ? toUploadRef(key) : value;
  }

  private walk(value: unknown, mapString: (s: string) => string): any {
    if (typeof value === 'string') return this.mapString(value, mapString);
    if (Array.isArray(value)) return value.map((v) => this.walk(v, mapString));
    if (!isPlainObject(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = this.walk(v, mapString);
    return out;
  }

  /** 媒体列表在部分接口里仍是 JSON 字符串数组 (如 photoList)，同样需要转换 */
  private mapString(value: string, mapString: (s: string) => string): string {
    if (value.startsWith('[') && value.endsWith(']') && /\/(?:uploads|api\/media)\/|https?:\/\//.test(value)) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
          return JSON.stringify(parsed.map(mapString));
        }
      } catch {
        // 非 JSON，按普通字符串处理
      }
    }
    return mapString(value);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
