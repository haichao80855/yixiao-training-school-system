import type { ClassOperationPort } from '../ports';
import type {
  ClassCompletionOptions,
  ClassCompletionReceipt,
  ClassWorkspaceView,
  RemoveStudentPayload,
  RemoveStudentResult,
} from '../types';

/**
 * 内存单测适配器 (Fake Class Operation Adapter)
 * 供单测与离线仿真环境使用，不依赖实际网络与后端微服务
 */
export class FakeClassOperationAdapter implements ClassOperationPort {
  readonly classes = new Map<string, ClassWorkspaceView>();
  readonly removeStudentCalls: RemoveStudentPayload[] = [];
  readonly completeClassCalls: Array<{
    classId: string;
    options?: ClassCompletionOptions;
  }> = [];

  shouldFailRemove: Error | null = null;
  shouldFailComplete: Error | null = null;
  shouldFailFetch: Error | null = null;

  /**
   * 预植入班级工作台全量测试基线数据
   */
  seedClass(classData: ClassWorkspaceView): void {
    this.classes.set(classData.id, JSON.parse(JSON.stringify(classData)));
  }

  /**
   * 模拟加载工作台
   */
  async fetchClassWorkspace(classId: string): Promise<ClassWorkspaceView> {
    if (this.shouldFailFetch) {
      throw this.shouldFailFetch;
    }
    const cls = this.classes.get(classId);
    if (!cls) {
      throw new Error(`班级不存在 (ID: ${classId})`);
    }
    const cloned = JSON.parse(JSON.stringify(cls));
    cloned.students = Array.isArray(cloned.students) ? cloned.students : [];
    cloned.schedules = Array.isArray(cloned.schedules) ? cloned.schedules : [];
    return cloned;
  }

  /**
   * 模拟移出学员并原子释放名额
   */
  async removeStudent(payload: RemoveStudentPayload): Promise<RemoveStudentResult> {
    if (this.shouldFailRemove) {
      throw this.shouldFailRemove;
    }

    this.removeStudentCalls.push(JSON.parse(JSON.stringify(payload)));

    const cls = this.classes.get(payload.classId);
    if (!cls) {
      throw new Error(`班级不存在 (ID: ${payload.classId})`);
    }

    if (
      cls.statusText === '已结班' ||
      cls.statusText === '已结课' ||
      (cls as any).status === 'completed' ||
      (cls as any).status === 'archived'
    ) {
      throw new Error(`班级「${cls.name}」已结课归档，无有效在班学员可供移出`);
    }

    cls.students = Array.isArray(cls.students) ? cls.students : [];
    cls.schedules = Array.isArray(cls.schedules) ? cls.schedules : [];

    const sIdx = cls.students.findIndex(
      (s) => s.studentId === payload.studentId || (s as any).id === payload.studentId
    );
    if (sIdx < 0) {
      throw new Error(`学员不存在或未在班 (ID: ${payload.studentId})`);
    }

    const student = cls.students[sIdx];
    cls.students.splice(sIdx, 1);
    if (typeof cls.currentStudentCount === 'number' && cls.currentStudentCount > 0) {
      cls.currentStudentCount--;
    } else {
      cls.currentStudentCount = cls.students.length;
    }

    return {
      success: true,
      classId: cls.id,
      className: cls.name,
      studentId: payload.studentId,
      studentName: student.name,
      packageId: `pkg-${payload.studentId}`,
      unassignedLessons: student.availableLessons || 10,
      newClassStudentCount: cls.currentStudentCount,
      studentStatus: 'normal',
      fallbackToUnassignedPool: true,
      message: `学员「${student.name}」已成功移出班级并回退至待分班资产池`,
    };
  }

  /**
   * 模拟结课归档
   */
  async completeClass(
    classId: string,
    options?: ClassCompletionOptions
  ): Promise<ClassCompletionReceipt> {
    if (this.shouldFailComplete) {
      throw this.shouldFailComplete;
    }

    this.completeClassCalls.push({
      classId,
      options: options ? JSON.parse(JSON.stringify(options)) : undefined,
    });

    const cls = this.classes.get(classId);
    if (!cls) {
      throw new Error(`班级不存在 (ID: ${classId})`);
    }

    if (
      cls.statusText === '已结班' ||
      cls.statusText === '已结课' ||
      (cls as any).status === 'completed' ||
      (cls as any).status === 'archived'
    ) {
      throw new Error(`班级「${cls.name}」已处于已结课状态，禁止重复结课`);
    }

    cls.students = Array.isArray(cls.students) ? cls.students : [];
    cls.schedules = Array.isArray(cls.schedules) ? cls.schedules : [];

    cls.statusText = '已结班';
    (cls as any).status = 'completed';
    const disposition = options?.disposition || { mode: 'fallback_unassigned' };
    const cancelFuture = options?.cancelFutureSchedules !== false;

    let cancelledScheduleCount = 0;
    let preservedAttendanceCount = 0;

    for (const s of cls.schedules) {
      const numActual = typeof s.actualCount === 'number' ? s.actualCount : Number(s.actualCount || 0);
      const hasAttendances = Array.isArray((s as any).attendances) && (s as any).attendances.length > 0;
      const isAttended =
        s.status === 'completed' ||
        numActual > 0 ||
        hasAttendances;

      if (isAttended) {
        preservedAttendanceCount++;
      } else if (cancelFuture) {
        s.status = 'cancelled';
        s.statusText = '已取消';
        cancelledScheduleCount++;
      }
    }

    const disposedStudentCount = cls.students.length;
    cls.students = [];
    cls.currentStudentCount = 0;

    return {
      success: true,
      receiptId: `REC-FAKE-${Date.now()}-${cls.id}`,
      classId: cls.id,
      className: cls.name,
      previousStatus: 'active',
      currentStatus: 'completed',
      disposedStudentCount,
      dispositionMode: disposition.mode,
      cancelledScheduleCount,
      preservedAttendanceCount,
      immutableFingerprint: `FP-SHA256-${Date.now()}`,
      completedAt: new Date().toISOString(),
      message: `班级「${cls.name}」已成功结课归档！释放未上排课 ${cancelledScheduleCount} 节，安置学员 ${disposedStudentCount} 人`,
    };
  }
}
