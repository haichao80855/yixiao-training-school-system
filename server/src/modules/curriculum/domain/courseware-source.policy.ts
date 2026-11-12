/**
 * 课件来源策略 (纯函数，无 IO)
 *
 * 平时课件直接用盛通 (下载源文件) 和百家云 (在线白板) 的公开链接。
 * 我们在自有 OSS 的 courseware/ 前缀下备份了部分盛通文件 (路径与原链接一一对应)。
 * 原平台打不开 (探测判定为故障) 或管理员手动切到备份时，改用备份文件的限时签名链接。
 */

export const SHENGTONG_HOST = 'public-prod-shengtong.oss-cn-zhangjiakou.aliyuncs.com';
export const BAIJIAYUN_HOST = 'pro-img-brtm.baijiayun.com';
export const MIRROR_PREFIX = 'courseware/shengtong/';

/** auto = 按探测结果自动切换；origin = 始终用原平台；mirror = 始终用备份 */
export type CoursewareSourceMode = 'auto' | 'origin' | 'mirror';
export const COURSEWARE_SOURCE_MODES: CoursewareSourceMode[] = ['auto', 'origin', 'mirror'];

export type CoursewareProvider = 'shengtong' | 'baijiayun';

export function parseHttpsUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function providerOf(raw: unknown): CoursewareProvider | null {
  const url = parseHttpsUrl(raw);
  if (!url) return null;
  if (url.hostname === SHENGTONG_HOST) return 'shengtong';
  if (url.hostname === BAIJIAYUN_HOST) return 'baijiayun';
  return null;
}

/**
 * 盛通原链接 -> 备份对象 key。与备份脚本的规则一致：路径做 URL 解码，连续的 / 合并为一个。
 * 非盛通链接或路径为空时返回 null。
 */
export function mirrorKeyOf(raw: unknown): string | null {
  const url = parseHttpsUrl(raw);
  if (!url || url.hostname !== SHENGTONG_HOST) return null;
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  path = path.replace(/\/+/g, '/').replace(/^\//, '');
  if (!path || path.split('/').some((seg) => seg === '..' || seg === '.')) return null;
  return MIRROR_PREFIX + path;
}

/** 备份对象 key -> 盛通原链接 (探测原平台是否可用时使用) */
export function originUrlOfMirrorKey(key: string): string | null {
  if (!key.startsWith(MIRROR_PREFIX)) return null;
  const path = key.slice(MIRROR_PREFIX.length);
  if (!path) return null;
  return `https://${SHENGTONG_HOST}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** 当前是否应该用备份：手动 mirror 一律用；auto 时看该平台是否被判定为故障 */
export function shouldUseMirror(mode: CoursewareSourceMode, originDown: boolean): boolean {
  if (mode === 'mirror') return true;
  if (mode === 'origin') return false;
  return originDown;
}

export function fileExtOf(name: string | undefined | null): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec((name || '').trim());
  return m ? m[1].toLowerCase() : '';
}

/** Office 在线预览支持的格式 (需要一个公网可访问的文件链接) */
export const OFFICE_PREVIEW_EXTS = new Set(['pptx', 'ppt', 'docx', 'doc']);

/** 下载文件名：去掉路径、控制字符和引号，避免拼进响应头出问题 */
export function safeFilename(name: string): string {
  const base = (name || '').split(/[\\/]/).pop() || '';
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\u0000-\u001f\u007f"]/g, '').trim().slice(0, 150) || '课件';
}

/** RFC 5987：中文文件名用 filename* 传递，同时给一个纯 ASCII 的 filename 兜底 */
export function contentDisposition(kind: 'attachment' | 'inline', filename: string): string {
  const name = safeFilename(filename);
  const ascii = name.replace(/[^\x20-\x7e]/g, '_');
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
