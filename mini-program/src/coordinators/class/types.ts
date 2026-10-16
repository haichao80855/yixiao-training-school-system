import type {
  ClassDetailModel,
  ClassScheduleItemModel,
  ClassStudentItemModel,
  ClassListItemModel,
} from '../../api/class';

export type {
  ClassDetailModel,
  ClassScheduleItemModel,
  ClassStudentItemModel,
  ClassListItemModel,
};

/**
 * 班级全景工作台聚合模型
 */
export type ClassWorkspaceView = ClassDetailModel;

/**
 * 结班学员资产处置策略 (对齐 ADR-0007)
 */
export interface ClassCompletionDisposition {
  mode: 'fallback_unassigned' | 'transfer_next_class' | 'archive_completed';
  targetClassId?: string;
}

/**
 * 结班入参选项
 */
export interface ClassCompletionOptions {
  disposition?: ClassCompletionDisposition;
  cancelFutureSchedules?: boolean;
  remark?: string;
  studentIds?: string[];
}

/**
 * 结班结构化审计凭单 (对齐 ADR-0007 ClassLifecycleReceipt)
 */
export interface ClassCompletionReceipt {
  receiptId: string;
  classId: string;
  className: string;
  previousStatus?: string;
  currentStatus: string;
  disposedStudentCount: number;
  dispositionMode: string;
  targetClassId?: string;
  targetClassName?: string;
  cancelledScheduleCount: number;
  preservedAttendanceCount: number;
  immutableFingerprint?: string;
  completedAt: string;
  success: boolean;
  message?: string;
}

/**
 * 移出学员命令入参 (对齐 ADR-0004 RemoveStudentCommand)
 */
export interface RemoveStudentPayload {
  classId: string;
  studentId: string;
  reason?: string;
  operator?: {
    operatorId?: string;
    operatorName?: string;
  };
}

/**
 * 移出学员执行回执 (对齐 ADR-0004 RemoveStudentResult)
 */
export interface RemoveStudentResult {
  success: boolean;
  classId: string;
  className?: string;
  studentId: string;
  studentName?: string;
  packageId?: string;
  unassignedLessons?: number;
  newClassStudentCount: number;
  studentStatus?: 'normal' | 'in_class';
  fallbackToUnassignedPool?: boolean;
  message?: string;
}

/**
 * 客户端班级生命周期与名册协调器核心接口
 */
export interface ClientClassCoordinatorInterface {
  removeStudent(classId: string, studentId: string, reason?: string): Promise<RemoveStudentResult>;
  completeClass(classId: string, options?: ClassCompletionOptions): Promise<ClassCompletionReceipt>;
  syncCancelledSchedules(schedules: ClassScheduleItemModel[]): ClassScheduleItemModel[];
  loadClassWorkspace(classId: string): Promise<ClassWorkspaceView>;
}
