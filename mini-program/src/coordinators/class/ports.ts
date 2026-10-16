import type {
  ClassCompletionOptions,
  ClassCompletionReceipt,
  ClassWorkspaceView,
  RemoveStudentPayload,
  RemoveStudentResult,
} from './types';

/**
 * 班级操作六边形端口 (Class Operation Hexagonal Port)
 */
export interface ClassOperationPort {
  /**
   * 加载班级工作台聚合大盘（班级基础信息、在班花名册、排课日程）
   */
  fetchClassWorkspace(classId: string): Promise<ClassWorkspaceView>;

  /**
   * 移出在班学员并回退待分班资产池 (ADR-0004)
   */
  removeStudent(payload: RemoveStudentPayload): Promise<RemoveStudentResult>;

  /**
   * 结课归档并批量物理注销未来无考勤排课 (ADR-0007)
   */
  completeClass(classId: string, options?: ClassCompletionOptions): Promise<ClassCompletionReceipt>;
}
