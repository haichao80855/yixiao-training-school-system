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
