import * as crypto from 'crypto';

/**
 * 本地存储签名链接 (HMAC-SHA256)
 * 迁移到 OSS 后改由 OSS 预签名，不再使用本签名器。
 */
let ephemeralSecret: string | null = null;

function signingSecret(): string {
  const configured = process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET;
  if (configured) return configured;
  // 未配置时使用进程级随机密钥：安全，但服务重启后旧链接失效
  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[media] MEDIA_SIGNING_SECRET 未配置，使用临时随机密钥；服务重启后已签发的媒体链接将失效');
  }
  return ephemeralSecret;
}

export function signMediaKey(key: string, expiresAtSeconds: number): string {
  return crypto
    .createHmac('sha256', signingSecret())
    .update(`${key}\n${expiresAtSeconds}`)
    .digest('base64url');
}

export function verifyMediaSignature(key: string, exp: string, sig: string): boolean {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return false;
  if (!sig) return false;
  const expected = Buffer.from(signMediaKey(key, expNum));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
