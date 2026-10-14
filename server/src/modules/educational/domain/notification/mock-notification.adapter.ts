import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationPort,
  ParentNotificationMessage,
  NotificationSendResult,
} from './notification.port';

/**
 * 内存测试通知适配器 (MockNoticeAdapter)
 * 用于单元测试、集成测试与本地开发调试，提供即时状态捕获与测试断言支持
 */
@Injectable()
export class MockNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(MockNotificationAdapter.name);
  public readonly sentMessages: ParentNotificationMessage[] = [];
  private shouldFailNext = false;
  private failErrorCode = 'MOCK_GATEWAY_TIMEOUT';

  async send(message: ParentNotificationMessage): Promise<NotificationSendResult> {
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      this.logger.warn(`[MockNoticeAdapter] 模拟触发发送失败: ${message.outboxId}`);
      return {
        outboxId: message.outboxId,
        success: false,
        errorCode: this.failErrorCode,
        errorMessage: '模拟微信网关超时或限流',
      };
    }

    this.sentMessages.push(message);
    const mockMsgId = `mock_msg_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this.logger.log(
      `[MockNoticeAdapter] 成功捕获出站通知 -> 学员: ${message.studentName}, openId: ${message.wechatOpenId || 'none'}, msgId: ${mockMsgId}`,
    );

    return {
      outboxId: message.outboxId,
      success: true,
      msgId: mockMsgId,
    };
  }

  async sendBatch(messages: ParentNotificationMessage[]): Promise<NotificationSendResult[]> {
    const results: NotificationSendResult[] = [];
    for (const msg of messages) {
      results.push(await this.send(msg));
    }
    return results;
  }

  // --- 测试辅助断言工具 ---

  clear(): void {
    this.sentMessages.length = 0;
    this.shouldFailNext = false;
  }

  simulateFailureOnce(errorCode = 'MOCK_GATEWAY_TIMEOUT'): void {
    this.shouldFailNext = true;
    this.failErrorCode = errorCode;
  }
}
