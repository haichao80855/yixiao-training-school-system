import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

/**
 * 业务领域异常定义
 */
export class CampusScopeMismatchException extends ForbiddenException {
  constructor(message = '校区作用域不匹配，严禁越权访问或修改其他校区排课课评') {
    super({ code: 403, error: 'CampusScopeMismatch', message });
  }
}

export class ScheduleCancelledException extends BadRequestException {
  constructor(scheduleId: string) {
    super({
      code: 400,
      error: 'ScheduleCancelled',
      message: `排课日程 [${scheduleId}] 已经取消或废弃，禁止发起或维护随堂课评`,
    });
  }
}

// ============================================================================
// 1. 水化上下文输入与工作台全景视图 (Hydration Contracts)
// ============================================================================

export interface CampusScopeContext {
  targetCampusId?: string;
  operatorId: string;
  operatorName: string;
  isSuperAdmin?: boolean;
}

export interface HydrateEvaluationQuery {
  readonly scheduleEventId: string;
  readonly teacherId?: string;
  readonly campusId?: string;
  readonly preferredTemplateId?: string;
}

export interface HydratedRosterItem {
  readonly studentId: string;
  readonly studentNo: string;
  readonly studentName: string;
  readonly parentPhone: string;
  readonly wechatOpenId: string | null;
  readonly isWechatBound: boolean;
  readonly attendanceStatus: 'present' | 'late' | 'leave' | 'absent' | 'unrecorded';
  readonly deductLessons: number;
  readonly personalizedComment?: string;
  readonly studentRating?: number;
  readonly performanceTag?: string;
}

export interface HydratedEvaluationWorkbench {
  readonly schedule: {
    readonly id: string;
    readonly date: string;
    readonly timeSlot: string;
    readonly classId: string;
    readonly className: string;
    readonly classroomName: string;
    readonly courseId: string;
    readonly courseName: string;
    readonly subject: string;
    readonly scheduleStatus: string;
  };

  readonly evaluation: {
    readonly isExisting: boolean;
    readonly status: 'draft' | 'published';
    readonly templateId: string;
    readonly templateName: string;
    readonly lessonTitle: string;
    readonly studyContentHtml: string;
    readonly overallRating: number;
    readonly voiceUrl?: string;
    readonly voiceDuration?: number;
    readonly videoUrl?: string;
    readonly photoList: string[];
    readonly teacherComment: string;
    readonly aiPolished: boolean;
    readonly lastPublishedAt?: string;
    readonly revisionNumber?: number;
  };

  readonly roster: HydratedRosterItem[];

  readonly summary: {
    readonly totalEnrolled: number;
    readonly attendedCount: number;
    readonly absentCount: number;
    readonly wechatBoundCount: number;
    readonly wechatUnboundCount: number;
  };
}

// ============================================================================
// 2. 提交命令与执行回执 (Commit Contracts)
// ============================================================================

export type NotificationDispatchStrategy = 'ATTENDED_ONLY' | 'ALL_ROSTER' | 'UNSENT_RETRY';

export interface CommitEvaluationCommand {
  readonly scheduleEventId: string;
  readonly campusId?: string;
  readonly operatorId: string;
  readonly operatorName: string;
  readonly publish: boolean; // true: 正式发布并推送家长; false: 仅暂存草稿
  readonly dispatchStrategy?: NotificationDispatchStrategy;
  readonly idempotencyKey?: string;

  readonly payload: {
    readonly templateId?: string;
    readonly templateName?: string;
    readonly lessonTitle: string;
    readonly studyContentHtml: string;
    readonly overallRating: number; // 1-5
    readonly voiceUrl?: string;
    readonly voiceDuration?: number;
    readonly videoUrl?: string;
    readonly photoList?: string[]; // <= 9
    readonly teacherComment: string;
    readonly aiPolished?: boolean;

    /** 可选：学员个性化特写覆盖项 */
    readonly studentOverrides?: Array<{
      readonly studentId: string;
      readonly personalizedComment?: string;
      readonly rating?: number;
      readonly performanceTag?: string;
    }>;
  };
}

export interface EvaluationCommitReceipt {
  readonly receiptId: string;
  readonly scheduleEventId: string;
  readonly classId: string;
  readonly className: string;
  readonly status: 'draft' | 'published';
  readonly committedAt: string;
  readonly operator: string;
  readonly revisionNumber: number;

  readonly attendanceSync: {
    readonly syncedCount: number;
    readonly scheduleSettled: boolean;
  };

  readonly dispatchResult: {
    readonly strategy: NotificationDispatchStrategy;
    readonly totalTargetCount: number;
    readonly outboxEnqueuedCount: number;
    readonly wechatSkippedCount: number;
    readonly unboundStudents: Array<{
      readonly studentId: string;
      readonly studentName: string;
      readonly parentPhone: string;
    }>;
  };

  readonly fingerprint: string; // SHA-256 不可变数字指纹
  readonly userMessage: string;
}
