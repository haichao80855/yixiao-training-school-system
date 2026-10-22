import { Injectable, Logger } from '@nestjs/common';

/**
 * 微信小程序 code2Session：用 wx.login 的 code 换取 openid
 * 未配置 WECHAT_MP_APPID / WECHAT_MP_SECRET 时跳过 (开发环境)，登录不受影响。
 */
@Injectable()
export class WechatMiniProgramClient {
  private readonly logger = new Logger(WechatMiniProgramClient.name);

  async resolveOpenId(code?: string): Promise<string | null> {
    const appId = process.env.WECHAT_MP_APPID;
    const secret = process.env.WECHAT_MP_SECRET;
    if (!code || !appId || !secret || typeof fetch !== 'function') return null;
    try {
      const url =
        `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appId)}` +
        `&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
      const res = await fetch(url);
      const body: any = await res.json();
      if (body?.openid) return body.openid as string;
      this.logger.warn(`code2Session 未返回 openid: errcode=${body?.errcode} errmsg=${body?.errmsg}`);
    } catch (err: any) {
      this.logger.warn(`code2Session 调用失败: ${err?.message}`);
    }
    return null;
  }
}
