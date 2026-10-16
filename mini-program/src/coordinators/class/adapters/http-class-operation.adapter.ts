import { request } from '../../../utils/request';
import { classApi } from '../../../api/class';
import type { ClassOperationPort } from '../ports';
import type {
  ClassCompletionOptions,
  ClassCompletionReceipt,
  ClassWorkspaceView,
  RemoveStudentPayload,
  RemoveStudentResult,
} from '../types';

/**
 * 生产级 HTTP 网络适配器 (Http Class Operation Adapter)
 * 对齐 ADR-0004 与 ADR-0007 服务端持久化接口
 */
export class HttpClassOperationAdapter implements ClassOperationPort {
  /**
   * 加载班级工作台聚合大盘
   */
  async fetchClassWorkspace(classId: string): Promise<ClassWorkspaceView> {
    const detail = await classApi.getClassDetail(classId);
    if (!detail || !detail.id) {
      throw new Error(`未找到班级详情 (ID: ${classId})`);
    }
    return detail;
  }

  /**
   * 移出在读学员并释放班容 (ADR-0004)
   * 真实调用服务端行级 CAS 并发锁并解除课包绑定
   */
  async removeStudent(payload: RemoveStudentPayload): Promise<RemoveStudentResult> {
    const res = await request<any>({
      url: '/api/educational/roster/remove',
      method: 'POST',
      data: {
        classId: payload.classId,
        studentId: payload.studentId,
        reason: payload.reason,
        operator: payload.operator,
      },
    });

    return {
      success: res?.success !== false,
      classId: res?.classId || payload.classId,
      className: res?.className,
      studentId: res?.studentId || payload.studentId,
      studentName: res?.studentName,
      packageId: res?.packageId,
      unassignedLessons: res?.unassignedLessons,
      newClassStudentCount:
        typeof res?.newClassStudentCount === 'number'
          ? res.newClassStudentCount
          : typeof res?.currentStudentCount === 'number'
            ? res.currentStudentCount
            : 0,
      studentStatus: res?.studentStatus || 'normal',
      fallbackToUnassignedPool: res?.fallbackToUnassignedPool ?? true,
      message: res?.message || '学员已成功移出班级并回退至待分班资产池',
    };
  }

  /**
   * 结课归档并批量物理注销未来无考勤排课 (ADR-0007)
   */
  async completeClass(
    classId: string,
    options?: ClassCompletionOptions
  ): Promise<ClassCompletionReceipt> {
    const disposition = options?.disposition || { mode: 'fallback_unassigned' };
    const cancelFutureSchedules = options?.cancelFutureSchedules !== false;

    const res = await request<any>({
      url: `/api/educational/classes/${classId}/complete`,
      method: 'POST',
      data: {
        disposition,
        cancelFutureSchedules,
        remark: options?.remark,
      },
    });

    return {
      success: res?.success !== false,
      receiptId: res?.receiptId || `REC-CMP-${Date.now()}`,
      classId: res?.classId || classId,
      className: res?.className || '',
      previousStatus: res?.previousStatus,
      currentStatus: res?.currentStatus || 'completed',
      disposedStudentCount: res?.disposedStudentCount ?? 0,
      dispositionMode: res?.dispositionMode || disposition.mode,
      targetClassId: res?.targetClassId,
      targetClassName: res?.targetClassName,
      cancelledScheduleCount: res?.cancelledScheduleCount ?? 0,
      preservedAttendanceCount: res?.preservedAttendanceCount ?? 0,
      immutableFingerprint: res?.immutableFingerprint,
      completedAt: res?.completedAt || new Date().toISOString(),
      message: res?.message || '班级已成功结课归档',
    };
  }
}
