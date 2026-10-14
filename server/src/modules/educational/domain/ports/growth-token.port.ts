import { Injectable, UnauthorizedException, BadRequestException, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { GrowthAccessTokenPayload } from '../learning-growth.types';

/**
 * 家长端免密访问安全令牌端口 (GrowthTokenPort)
 * 遵循 DEEPENING.md Ports & Adapters 规范
 */
export abstract class GrowthTokenPort {
  abstract signToken(payload: GrowthAccessTokenPayload): string;
  abstract verifyToken(token: string): GrowthAccessTokenPayload;
}

/**
 * 生产适配器：基于 HMAC-SHA256 的紧凑型无状态签名 Token
 * 具备防时序侧信道攻击 (timingSafeEqual) 与防 IDOR 越权屏障
 */
@Injectable()
export class HmacSha256TokenAdapter implements GrowthTokenPort {
  private readonly secret: string;

  constructor(@Optional() secretKey?: string) {
    this.secret = secretKey || process.env.GROWTH_TOKEN_SECRET || 'yixiao-growth-secret-key-2026';
  }

  signToken(payload: GrowthAccessTokenPayload): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${body}`)
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  verifyToken(token: string): GrowthAccessTokenPayload {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('缺失安全访问令牌 (Missing token)');
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new BadRequestException('令牌格式不合规 (Malformed token)');
    }
    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', this.secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      throw new UnauthorizedException('令牌签名无效或已被篡改 (Invalid signature)');
    }

    let payload: GrowthAccessTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('令牌载荷解析失败 (Invalid token payload)');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSeconds) {
      throw new UnauthorizedException('学情报告访问令牌已过期 (Token expired)');
    }

    return payload;
  }
}

/**
 * 测试/离线适配器：确定性固定签名
 * 支持单测无状态秒级比对与快速断言
 */
export class DeterministicMockTokenAdapter implements GrowthTokenPort {
  signToken(payload: GrowthAccessTokenPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64');
    return `mock.jwt.${body}.mock_sig`;
  }

  verifyToken(token: string): GrowthAccessTokenPayload {
    if (!token || !token.startsWith('mock.jwt.')) {
      throw new UnauthorizedException('Mock 令牌签名不匹配');
    }
    const parts = token.split('.');
    if (parts.length !== 4) {
      throw new BadRequestException('Mock 令牌格式不合规');
    }
    const bodyBase64 = parts[2];
    const payload = JSON.parse(Buffer.from(bodyBase64, 'base64').toString('utf8')) as GrowthAccessTokenPayload;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSeconds) {
      throw new UnauthorizedException('Mock 令牌已过期');
    }
    return payload;
  }
}
