import { BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { CampusScopeContext } from './lesson-evaluation.types';

export { CampusScopeContext };

/**
 * 业务领域异常定义
 */
export class CampusScopeMismatchException extends ForbiddenException {
  constructor(message = '校区作用域不匹配，严禁越权访问或修改其他校区排课结课履约') {
    super({ code: 403, error: 'CampusScopeMismatch', message });
  }
}

export class ScheduleCancelledException extends BadRequestException {
  constructor(scheduleId: string) {
    super({
      code: 400,
      error: 'ScheduleCancelled',
      message: `排课日程 [${scheduleId}] 已经取消或废弃，禁止发起或维护随堂结课履约`,
    });
  }
}

export class RefundLockedException extends ConflictException {
  constructor(packageId: string) {
    super({
      code: 409,
      error: 'RefundLocked',
      message: `【财务防腐屏障 ACB 拦截】课包 [${packageId}] 已完成退费归档（RefundLocked），严禁通过反结课冲正将其错误复活为 active 状态！`,
    });
  }
}

// ============================================================================
// 1. 履约模式与重开策略枚举
// ============================================================================

/**
 * 结课履约模式：
 * - FULL_SETTLE: 90% 默认常规通途（随堂点名扣费 + 课评持久化 + 微信出站通知）
 * - ATTENDANCE_ONLY: 现场极速打卡（仅随堂点名扣费，暂不生成课评与信箱）
 * - PUBLISH_EVALUATION: 课后单独补录（为已打卡课次补录持久化课评并灌装出站信箱）
 */
export type FulfillmentMode = 'FULL_SETTLE' | 'ATTENDANCE_ONLY' | 'PUBLISH_EVALUATION';

/**
 * 反结课冲正策略：
 * - FULL_ROLLBACK: 默认完全回滚（原路退还课包课时 + 作废课评 + 作废在途信箱通知 + 排课恢复待上课）
 * - REOPEN_EVALUATION: 仅重开课评（课时扣减完全保留，仅作废旧课评与在途通知、重置考勤评语，供教师重填）
 */
export type ReversalStrategy = 'FULL_ROLLBACK' | 'REOPEN_EVALUATION';

export type AttendanceStatus = 'present' | 'leave' | 'absent' | 'late';

export type DispatchStrategy = 'ATTENDED_ONLY' | 'ALL_ENROLLED' | 'NONE';

// ============================================================================
// 2. 智能工作台水化契约 (Hydration Contracts)
// ============================================================================

export interface PrepareFulfillmentQuery {
  readonly scheduleEventId: string;
  readonly teacherId?: string;
  readonly campusId?: string;
  readonly preferredTemplateId?: string;
}

export interface FulfillmentStudentView {
  readonly studentId: string;
  readonly studentNo: string;
  readonly studentName: string;
  readonly phone: string;
  readonly gender?: string;
  readonly packageId?: string;
  readonly remainingLessons: number;
  readonly bonusLessons: number;
  readonly totalLessons: number;
  readonly isLowBalance: boolean;
  readonly wechatOpenId: string | null;
  readonly isWechatBound: boolean;
  readonly defaultStatus: AttendanceStatus;
  readonly defaultDeductLessons: number;
  readonly defaultRating: number;
  readonly isRecorded: boolean;
  readonly recordedStatus?: AttendanceStatus;
  readonly currentComment?: string;
  readonly currentRating?: string | number;
  readonly isEvaluated?: boolean;
  /** 家长端是否可见该学员本课次课评：课评已发布 且 (学员到课 或 有专属课评内容) */
  readonly isPublished?: boolean;
  readonly isExempt?: boolean;
  readonly hasPersonalEvaluation?: boolean;
  readonly evaluatedAt?: string;
  readonly evaluatedSource?: string;
  readonly photos?: string[];
  readonly videoUrl?: string;
}

export interface FulfillmentWorkbenchView {
  readonly schedule: {
    readonly id: string;
    readonly date: string;
    readonly timeSlot: string;
    readonly startTime: string;
    readonly endTime: string;
    readonly classId: string;
    readonly className: string;
    readonly classroomId: string;
    readonly classroomName: string;
    readonly courseId: string;
    readonly courseName: string;
    readonly subject: string;
    readonly teacherId: string;
    readonly teacherName: string;
    readonly status: string;
    readonly canSettle: boolean;
    readonly expectedCount?: number;
    readonly actualCount?: number;
  };

  readonly evaluationDraft: {
    readonly isExisting: boolean;
    readonly evaluationStatus?: string;
    readonly templateId: string;
    readonly templateName: string;
    readonly lessonTitle: string;
    readonly studyContentHtml: string;
    readonly overallRating: number;
    readonly teacherComment: string;
    readonly voiceUrl?: string;
    readonly voiceDuration?: number;
    readonly videoUrl?: string;
    readonly photoList: string[];
    readonly aiPolished: boolean;
    readonly lastPublishedAt?: string;
    readonly revisionNumber?: number;
  };

  readonly students: FulfillmentStudentView[];

  readonly summary: {
    readonly totalStudents: number;
    readonly defaultPresentCount: number;
    readonly wechatBoundCount: number;
    readonly wechatUnboundCount: number;
    readonly estimatedDeductLessons: number;
  };
}

// ============================================================================
// 3. 履约提交命令与异常学员差异覆写 (Commit Contracts)
// ============================================================================

export interface StudentFulfillmentOverride {
  readonly studentId: string;
  readonly status?: AttendanceStatus;
  readonly deductLessons?: number;
  readonly rating?: number;
  readonly personalizedComment?: string;
  readonly performanceTag?: string;
  readonly photos?: string[];
  readonly videoUrl?: string;
  readonly isEvaluated?: boolean;
}

export interface FulfillLessonCommand {
  readonly scheduleEventId: string;
  readonly mode?: FulfillmentMode;
  readonly targetStudentId?: string;
  readonly lessonTitle?: string;
  readonly templateId?: string;
  readonly templateName?: string;
  readonly studyContentHtml?: string;
  readonly overallRating?: number;
  readonly teacherComment?: string;
  readonly voiceUrl?: string;
  readonly voiceDuration?: number;
  readonly videoUrl?: string;
  readonly photoList?: string[];
  readonly aiPolished?: boolean;
  /**
   * 异常学员增量覆写集合 (Zero-ceremony Happy Path: 未列入者全员默认到课 + 扣 1 课时 + 5星)
   */
  readonly anomalyOverrides?: StudentFulfillmentOverride[];
  readonly dispatchStrategy?: DispatchStrategy;
  readonly idempotencyKey?: string;
  readonly campusId?: string;
  readonly operatorId?: string;
  readonly operatorName?: string;
}

export interface SettlementDetailItem {
  readonly studentId: string;
  readonly packageId?: string;
  readonly deductLessons: number;
  readonly regularBurned: number;
  readonly bonusBurned: number;
  readonly remainingAfter: number;
}

export interface FulfillmentReceipt {
  readonly receiptId: string;
  readonly scheduleEventId: string;
  readonly mode: FulfillmentMode;
  readonly completedAt: string;
  readonly operator: string;
  readonly totalStudents: number;
  readonly settlement: {
    readonly totalDeductedLessons: number;
    readonly regularBurned: number;
    readonly bonusBurned: number;
    readonly presentCount: number;
    readonly lateCount: number;
    readonly leaveCount: number;
    readonly absentCount: number;
    readonly details: SettlementDetailItem[];
  };
  readonly evaluation: {
    readonly evaluationId: string;
    readonly revisionNumber: number;
    readonly status: string;
    readonly syncedAttendanceCount: number;
    readonly fingerprint: string;
  } | null;
  readonly outbox: {
    readonly enqueuedCount: number;
    readonly skippedCount: number;
    readonly strategy: DispatchStrategy;
  } | null;
  readonly message: string;
}

// ============================================================================
// 4. 反结课级联冲正命令与凭证 (Reversal Contracts)
// ============================================================================

export interface ReverseFulfillmentCommand {
  readonly scheduleEventId: string;
  readonly strategy?: ReversalStrategy;
  readonly reason?: string;
  readonly campusId?: string;
  readonly operatorId?: string;
  readonly operatorName?: string;
}

export interface ReversalDetailItem {
  readonly studentId: string;
  readonly packageId: string;
  readonly refundedLessons: number;
  readonly remainingAfter: number;
}

export interface FulfillmentReversalReceipt {
  readonly receiptId: string;
  readonly scheduleEventId: string;
  readonly strategy: ReversalStrategy;
  readonly reversedAt: string;
  readonly operator: string;
  readonly reason: string;
  readonly settlementReversal: {
    readonly reversedAttendanceCount: number;
    readonly refundedTotalLessons: number;
    readonly refundedRegularLessons: number;
    readonly refundedBonusLessons: number;
    readonly details: ReversalDetailItem[];
  } | null;
  readonly evaluationReversal: {
    readonly evaluationId?: string;
    readonly previousStatus?: string;
    readonly nextStatus: string;
    readonly cancelledOutboxCount: number;
  } | null;
  readonly message: string;
}
