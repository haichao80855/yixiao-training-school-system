import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  NotificationPort,
  NOTIFICATION_PORT,
  ParentNotificationMessage,
  NotificationSendResult,
} from './notification.port';

export interface DispatchSummary {
  totalProcessed: number;
  sentCount: number;
  failedCount: number;
  results: NotificationSendResult[];
}

/**
 * 课评出站信箱流水线调度器 (OutboxNotificationDispatcher)
 * 实现事务性信箱 (Transactional Outbox) 异步派发、失败重试与状态跟踪
 */
@Injectable()
export class OutboxNotificationDispatcher {
  private readonly logger = new Logger(OutboxNotificationDispatcher.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: NotificationPort,
  ) {}

  /**
   * 触发即时异步非阻塞派发 (发布课评后调用，由后台线程处理，绝不阻塞前端返回)
   */
  triggerImmediateDispatch(evaluationId: string): void {
    setImmediate(async () => {
      try {
        await this.dispatchPendingMessages(evaluationId);
      } catch (err: any) {
        this.logger.error(`[OutboxDispatcher] 即时信箱派发异常: ${err.message}`, err.stack);
      }
    });
  }

  /**
   * 处理待发消息批次 (支持指定 evaluationId 或全局扫表)
   */
  async dispatchPendingMessages(evaluationId?: string): Promise<DispatchSummary> {
    if (this.isProcessing) {
      return { totalProcessed: 0, sentCount: 0, failedCount: 0, results: [] };
    }

    this.isProcessing = true;
    const summary: DispatchSummary = {
      totalProcessed: 0,
      sentCount: 0,
      failedCount: 0,
      results: [],
    };

    try {
      const now = new Date();
      const whereClause: any = {
        status: 'pending',
        nextRetryAt: { lte: now },
      };
      if (evaluationId) {
        whereClause.evaluationId = evaluationId;
      }

      const pendingMessages = await this.prisma.lessonEvaluationOutbox.findMany({
        where: whereClause,
        take: 50,
        orderBy: { createdAt: 'asc' },
      });

      if (pendingMessages.length === 0) {
        return summary;
      }

      this.logger.log(`[OutboxDispatcher] 拾取待发信箱记录 ${pendingMessages.length} 条...`);

      for (const outboxItem of pendingMessages) {
        summary.totalProcessed++;
        let payloadData: any = {};
        try {
          payloadData = JSON.parse(outboxItem.payload);
        } catch {
          payloadData = {};
        }

        const msg: ParentNotificationMessage = {
          outboxId: outboxItem.id,
          studentId: outboxItem.studentId,
          studentName: payloadData.studentName || '学员',
          parentPhone: payloadData.parentPhone,
          wechatOpenId: outboxItem.recipientTarget,
          className: payloadData.className || '在读班级',
          courseName: payloadData.courseName || '教学课程',
          lessonTitle: payloadData.lessonTitle || '随堂课次',
          ratingText: payloadData.ratingText || `${payloadData.rating || 5} 星表现`,
          teacherComment: payloadData.comment || payloadData.teacherComment || '随堂表现优异',
          publishTime: payloadData.publishedAt || new Date().toISOString(),
          h5ReportUrl: payloadData.h5ReportUrl,
        };

        const result = await this.notificationPort.send(msg);
        summary.results.push(result);

        if (result.success) {
          summary.sentCount++;
          await this.prisma.lessonEvaluationOutbox.update({
            where: { id: outboxItem.id },
            data: {
              status: 'sent',
              receiptId: result.msgId,
              sentAt: new Date(),
              lastError: null,
            },
          });
        } else {
          summary.failedCount++;
          const nextRetryCount = outboxItem.retryCount + 1;
          const isDead = nextRetryCount >= outboxItem.maxRetries;
          // 指数退避: 10s, 30s, 120s
          const backoffSec = Math.pow(nextRetryCount, 2) * 15;
          const nextTime = new Date(Date.now() + backoffSec * 1000);

          await this.prisma.lessonEvaluationOutbox.update({
            where: { id: outboxItem.id },
            data: {
              status: isDead ? 'failed' : 'pending',
              retryCount: nextRetryCount,
              nextRetryAt: nextTime,
              lastError: `[${result.errorCode || 'ERR'}] ${result.errorMessage || '未知错误'}`,
            },
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return summary;
  }
}
