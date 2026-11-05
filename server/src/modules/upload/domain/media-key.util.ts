/**
 * 媒体存储 key 工具
 * 数据库中历史媒体字段可能是：完整 URL (http://host/uploads/x.jpg)、相对 URL (/uploads/x.jpg) 或纯 key (x.jpg)。
 * 统一转换为与存储介质无关的 key，迁移到 OSS 时无需改数据。
 */
const UPLOADS_PREFIX = /^\/?uploads\//;
const OWN_UPLOAD_URL = /^https?:\/\/[^/]+\/uploads\/([^?#]+)/;

export function isExternalUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** 转为存储 key；第三方外链 (非本系统 /uploads/) 原样返回 */
export function toStorageKey(value: string): string {
  if (!value) return value;
  const trimmed = value.trim();
  const own = trimmed.match(OWN_UPLOAD_URL);
  if (own) return decodeURIComponent(own[1]);
  if (isExternalUrl(trimmed)) return trimmed;
  return trimmed.split(/[?#]/)[0].replace(UPLOADS_PREFIX, '').replace(/^\/+/, '');
}

/** key 是否安全 (禁止路径穿越与绝对路径) */
export function isSafeStorageKey(key: string): boolean {
  return (
    !!key &&
    !key.includes('..') &&
    !key.includes('\\') &&
    !key.startsWith('/') &&
    /^[\w\-./]+$/.test(key)
  );
}

/** 解析 JSON 字符串数组形式的媒体列表 */
export function parseMediaList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    }
  } catch {
    // 兼容历史数据：单个 URL 字符串
    if (raw.trim()) return [raw.trim()];
  }
  return [];
}

/** 整串为本系统上传的学员媒体引用 (MediaUploadCoordinator 写入的 photos/、videos/ 前缀)，可带缩略图参数 */
const OWN_UPLOAD_REF = /^(?:https?:\/\/[^/\s]+)?\/uploads\/(?:photos|videos)\/[^?#\s]+(?:[?#]\S*)?$/;
/** 缩略图 / 视频封面派生参数 (MediaUploadCoordinator 与 MediaStoragePort 生成) */
const THUMB_HINT = /[?&#](?:w=|x-oss-process=|poster)/;

/** 大图预览派生参数：教师端点开大图时用，长边不超过 1280 */
const PREVIEW_HINT = /[?&#]preview=/;

export function isPreviewRef(value: string): boolean {
  return PREVIEW_HINT.test(value);
}

/**
 * 给本系统媒体引用加派生参数，由 MediaLinkInterceptor 签发成缩略图 / 预览图 / 视频封面链接。
 * 不改变存储 key；第三方外链和已带参数的引用原样返回。
 */
export function mediaVariantRef(ref: string, variant: 'thumb' | 'preview'): string {
  if (!isOwnUploadRef(ref) || /[?#]/.test(ref)) return ref;
  return `${ref}?${variant === 'thumb' ? 'w=300' : 'preview=1'}`;
}

export function isOwnUploadRef(value: string): boolean {
  return OWN_UPLOAD_REF.test(value);
}

export function isThumbnailRef(value: string): boolean {
  return THUMB_HINT.test(value);
}

/** 存储 key 的规范持久化形式 (与历史数据一致，可被 toStorageKey 还原) */
export function toUploadRef(key: string): string {
  return `/uploads/${key}`;
}

/** 本地 / 内存引擎签名路由 /api/media/<key>?exp=&sig= 还原为 key */
export function keyFromLocalMediaRoute(url: string): string | null {
  const match = url.match(/^(?:https?:\/\/[^/\s]+)?\/api\/media\/([^?#\s]+)\?(\S*)$/);
  if (!match || !/(?:^|&)sig=/.test(match[2])) return null;
  let key: string;
  try {
    key = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return isSafeStorageKey(key) ? key : null;
}
