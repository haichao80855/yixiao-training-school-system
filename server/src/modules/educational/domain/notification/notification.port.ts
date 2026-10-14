/**
 * 课评通知出站端口契约 (NotificationPort)
 * 遵循 Ports & Adapters 架构接缝规范，严格隔离微信公众号等外部不可控依赖
 */

export interface ParentNotificationMessage {
  readonly outboxId: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly parentPhone?: string;
  readonly wechatOpenId?: string | null;
  readonly className: string;
  readonly courseName: string;
  readonly lessonTitle: string;
  readonly ratingText: string;
  readonly teacherComment: string;
  readonly publishTime: string;
  readonly h5ReportUrl?: string;
}

export interface NotificationSendResult {
  readonly outboxId: string;
  readonly success: boolean;
  readonly msgId?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

export interface NotificationPort {
  /**
   * 单条通知派发
   */
  send(message: ParentNotificationMessage): Promise<NotificationSendResult>;

  /**
   * 批量通知派发
   */
  sendBatch(messages: ParentNotificationMessage[]): Promise<NotificationSendResult[]>;
}
