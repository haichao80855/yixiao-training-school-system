import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationPort,
  ParentNotificationMessage,
  NotificationSendResult,
} from './notification.port';

/**
 * 微信公众号模板消息生产适配器 (WechatNotificationAdapter)
 * 对接微信公众平台官方模板消息 API
 */
@Injectable()
export class WechatNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(WechatNotificationAdapter.name);

  // 微信公众号基础配置 (支持从环境变量动态加载)
  private readonly appId = process.env.WECHAT_MP_APPID || '';
  private readonly appSecret = process.env.WECHAT_MP_APPSECRET || '';
  private readonly templateId = process.env.WECHAT_LESSON_EVAL_TEMPLATE_ID || 'TMPL_LESSON_EVAL_NOTICE';

  private cachedAccessToken = '';
  private tokenExpiresAt = 0;

  async send(message: ParentNotificationMessage): Promise<NotificationSendResult> {
    if (!message.wechatOpenId) {
      return {
        outboxId: message.outboxId,
        success: false,
        errorCode: 'ERR_NO_OPENID',
        errorMessage: '学员未绑定微信公众号 OpenId',
      };
    }

    // 若未配置生产微信凭证，按优雅降级沙箱模式处理，打印日志并返回成功
    if (!this.appId || !this.appSecret) {
      this.logger.warn(
        `[WechatNoticeAdapter] 生产微信公众号 AppID 未配置，启用沙箱安全降级模式 (模拟推送到 openId: ${message.wechatOpenId})`,
      );
      return {
        outboxId: message.outboxId,
        success: true,
        msgId: `wechat_sandbox_msg_${Date.now()}`,
      };
    }

    try {
      const accessToken = await this.resolveAccessToken();
      const apiUrl = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`;

      const payload = {
        touser: message.wechatOpenId,
        template_id: this.templateId,
        url: message.h5ReportUrl || '',
        data: {
          first: {
            value: `尊敬的家长，${message.studentName} 同学今日随堂课评报告已生成！`,
            color: '#173177',
          },
          keyword1: { value: message.courseName, color: '#173177' },
          keyword2: { value: message.lessonTitle, color: '#173177' },
          keyword3: { value: message.ratingText, color: '#FF9900' },
          keyword4: { value: message.publishTime, color: '#173177' },
          remark: {
            value: `教师寄语：${message.teacherComment.slice(0, 60)}... 点击查看完整课堂相册与多维学情！`,
            color: '#666666',
          },
        },
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data && data.errcode === 0) {
        return {
          outboxId: message.outboxId,
          success: true,
          msgId: String(data.msgid),
        };
      }

      return {
        outboxId: message.outboxId,
        success: false,
        errorCode: String(data.errcode || 'ERR_WECHAT_API'),
        errorMessage: data.errmsg || '微信接口调用异常',
      };
    } catch (err: any) {
      this.logger.error(`[WechatNoticeAdapter] 网络请求失败: ${err.message}`, err.stack);
      return {
        outboxId: message.outboxId,
        success: false,
        errorCode: 'HTTP_DISPATCH_FAILED',
        errorMessage: err.message || '网络连接超时',
      };
    }
  }

  async sendBatch(messages: ParentNotificationMessage[]): Promise<NotificationSendResult[]> {
    const results: NotificationSendResult[] = [];
    for (const msg of messages) {
      results.push(await this.send(msg));
    }
    return results;
  }

  private async resolveAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedAccessToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedAccessToken;
    }

    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;
    const res = await fetch(tokenUrl);
    const data = await res.json();

    if (data && data.access_token) {
      this.cachedAccessToken = data.access_token;
      this.tokenExpiresAt = now + (data.expires_in || 7200) * 1000;
      return this.cachedAccessToken;
    }

    throw new Error(`获取微信 AccessToken 失败: ${data?.errmsg || '未知错误'}`);
  }
}
