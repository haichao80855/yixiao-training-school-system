/**
 * ============================================================================
 * 拓视未来教育「一校教培系统」教学班级全生命周期协调器核心契约
 * 领域概念对齐 GLOSSARY.md 与 ADR-0007
 * ============================================================================
 */

export type ClassLifecycleStatus =
  | 'recruiting'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type LifecycleActionType = 'activate' | 'complete' | 'cancel' | 'merge';

export interface OperatorContext {
  operatorId?: string;
  operatorName?: string;
  campusId?: string;
  clientIp?: string;
}

// ----------------------------------------------------------------------------
// 1. 在读学员课包处置策略 (StudentDispositionPolicy)
// ----------------------------------------------------------------------------
export type StudentDispositionPolicy =
  | {
      /** 回退待分班资产池：课包 classId 清空，剩余课时保全，学员学籍自愈 */
      mode: 'fallback_unassigned';
    }
  | {
      /** 批量升班：将全班学员课包原子迁移至进阶目标班级 (CAS 校验目标班容) */
      mode: 'transfer_next_class';
      targetClassId: string;
    }
  | {
      /** 课时完结归档：仅在学员课包无剩余课时时允许，直接标记课包 completed */
      mode: 'archive_completed';
    };

// ----------------------------------------------------------------------------
// 2. 招生转开班 (activateClass)
// ----------------------------------------------------------------------------
export interface ActivateClassCommand {
  classId: string;
  /** 可选：校准实际开课日期 */
  actualStartDate?: string;
  /** 可选：最低开班人数门槛校验 (默认 1 人，0 表示允许空班开班) */
  minStudentCount?: number;
  operator?: OperatorContext;
}

export interface ActivateClassResult {
  success: boolean;
  classId: string;
  className: string;
  previousStatus: ClassLifecycleStatus;
  currentStatus: ClassLifecycleStatus;
  enrolledStudentCount: number;
  startDate: string;
  activatedScheduleCount: number;
  receiptId: string;
  message: string;
}

// ----------------------------------------------------------------------------
// 3. 正常结课结业 (completeClass)
// ----------------------------------------------------------------------------
export interface CompleteClassCommand {
  classId: string;
  /** 在读学员课包安置策略 */
  disposition: StudentDispositionPolicy;
  /** 是否自动撤销清理未完排课日程 (默认 true) */
  cancelFutureSchedules?: boolean;
  /** 结业说明 / 备注 */
  remark?: string;
  operator?: OperatorContext;
}

export interface CompleteClassResult {
  success: boolean;
  classId: string;
  className: string;
  previousStatus: ClassLifecycleStatus;
  currentStatus: ClassLifecycleStatus;
  disposedStudentCount: number;
  dispositionMode: 'fallback_unassigned' | 'transfer_next_class' | 'archive_completed';
  targetClassId?: string;
  targetClassName?: string;
  cancelledScheduleCount: number;
  preservedAttendanceCount: number;
  receiptId: string;
  immutableFingerprint: string;
  message: string;
}

// ----------------------------------------------------------------------------
// 4. 异常解散取消班级 (cancelClass)
// ----------------------------------------------------------------------------
export interface CancelClassCommand {
  classId: string;
  /** 解散原因 (必填) */
  reason: string;
  operator?: OperatorContext;
}

export interface CancelClassResult {
  success: boolean;
  classId: string;
  className: string;
  disbandedStudentCount: number;
  revokedScheduleCount: number;
  historicalAttendancesPreserved: number;
  isSoftDisbanded: boolean; // 若已有历史消课记录，严禁物理删除，标记为软解散 completed
  receiptId: string;
  immutableFingerprint: string;
  message: string;
}

// ----------------------------------------------------------------------------
// 5. 班级全量合并 (mergeClasses)
// ----------------------------------------------------------------------------
export interface MergeClassesCommand {
  /** 待合并撤销的源班级 ID 列表 (至少 1 个) */
  sourceClassIds: string[];
  /** 接收合并学员的目标班级 ID */
  targetClassId: string;
  /** 源班级处置方式：'complete' (归档为已结业合并) 或 'keep_empty' (保留空班) */
  sourceDisposition?: 'complete' | 'keep_empty';
  reason?: string;
  operator?: OperatorContext;
}

export interface MergeClassesResult {
  success: boolean;
  targetClassId: string;
  targetClassName: string;
  migratedStudentCount: number;
  mergedSourceClassCount: number;
  targetCurrentStudentCount: number;
  targetCapacity: number;
  receiptId: string;
  immutableFingerprint: string;
  message: string;
}

// ----------------------------------------------------------------------------
// 6. 二阶段仿真预演 (previewOperation) 与回执模型
// ----------------------------------------------------------------------------
export interface LifecycleCheckIssue {
  code:
    | 'ILLEGAL_TRANSITION'
    | 'MIN_CAPACITY_NOT_MET'
    | 'ACTIVE_STUDENTS_REMAIN'
    | 'TARGET_CLASS_CAPACITY_EXCEEDED'
    | 'TARGET_CLASS_NOT_FOUND'
    | 'HISTORICAL_ATTENDANCE_LOCKED'
    | 'UNCONSUMED_LESSONS_REMAIN'
    | 'CROSS_CAMPUS_FORBIDDEN'
    | 'CROSS_COURSE_FORBIDDEN';
  severity: 'blocking' | 'warning' | 'info';
  message: string;
  metadata?: Record<string, any>;
}

export interface PreviewLifecycleCommand {
  classId: string;
  action: LifecycleActionType;
  disposition?: StudentDispositionPolicy;
  targetClassId?: string;
  minStudentCount?: number;
  cancelFutureSchedules?: boolean;
  reason?: string;
}

export interface ClassLifecyclePreview {
  allowed: boolean;
  classId: string;
  className: string;
  action: LifecycleActionType;
  currentStatus: ClassLifecycleStatus;
  targetStatus: ClassLifecycleStatus;
  issues: LifecycleCheckIssue[];
  impact: {
    affectedStudentCount: number;
    affectedPackageCount: number;
    cancelledScheduleCount: number;
    auditedHistoricalAttendanceCount: number;
    freedClassroomSlots: number;
    targetClassRemainingCapacityBefore?: number;
    targetClassRemainingCapacityAfter?: number;
  };
  summary: string;
}

/**
 * 不可变生命周期处置凭单 (ClassLifecycleReceipt)
 */
export interface ClassLifecycleReceipt {
  receiptId: string;
  classId: string;
  className: string;
  action: LifecycleActionType;
  fromStatus: ClassLifecycleStatus;
  toStatus: ClassLifecycleStatus;
  executedAt: string;
  operator: OperatorContext;
  reason?: string;
  rosterDispositions: Array<{
    studentId: string;
    studentName: string;
    packageId: string;
    disposition: string;
    targetClassId?: string | null;
    remainingLessons: number;
    healedStudentStatus: 'normal' | 'in_class' | 'graduated';
  }>;
  scheduleDispositions: {
    cancelledScheduleCount: number;
    preservedAttendanceCount: number;
    freedClassroomId?: string;
    freedClassroomName?: string;
  };
  immutableFingerprint: string;
}
