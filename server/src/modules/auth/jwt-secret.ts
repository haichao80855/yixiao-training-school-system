/** 仅供本地开发与测试使用的回退密钥，生产环境禁止使用 */
const DEV_FALLBACK_SECRET = 'shengtong_edu_secret_key_2026_antigravity';
const PLACEHOLDER_SECRETS = new Set([DEV_FALLBACK_SECRET, 'replace-with-your-own-secret']);
const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * 解析 JWT 签名密钥
 * 生产环境 (NODE_ENV=production) 未配置、使用模板占位值或长度不足时拒绝启动，杜绝用公开密钥伪造令牌。
 */
export function resolveJwtSecret(configured: string | undefined, nodeEnv = process.env.NODE_ENV): string {
  const secret = configured?.trim();
  if (nodeEnv !== 'production') return secret || DEV_FALLBACK_SECRET;

  if (!secret || PLACEHOLDER_SECRETS.has(secret) || secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(
      `生产环境必须配置 JWT_SECRET (至少 ${MIN_PRODUCTION_SECRET_LENGTH} 位随机字符，不得使用模板占位值)，可用 openssl rand -hex 32 生成`,
    );
  }
  return secret;
}
