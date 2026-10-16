import { studentProjector } from '../../projectors/student';
import type { ClassOperationPort } from './ports';
import { HttpClassOperationAdapter } from './adapters/http-class-operation.adapter';
import { FakeClassOperationAdapter } from './adapters/fake-class-operation.adapter';
import type {
  ClassCompletionOptions,
  ClassCompletionReceipt,
  ClassScheduleItemModel,
  ClassWorkspaceView,
  ClientClassCoordinatorInterface,
  RemoveStudentResult,
} from './types';

/**
 * 微信小程序移动端班级花名册异动与生命周期操作深模块
 * Client Class Lifecycle & Roster Coordinator
 *
 * 架构契约：
 * 1. 极简外部接口 Interface：仅暴露任务型动词 (removeStudent, completeClass, syncCancelledSchedules, loadClassWorkspace)；
 * 2. 六边形端口与适配器 Seam：通过 ClassOperationPort 与网络物理脱耦，零破坏支持 Fake / Http 适配器插拔；
 * 3. 严格对齐后端 ADR-0004 与 ADR-0007，杜绝“本地 splice 假删除”与“无参裸结班未来排课幽灵占用”；
 * 4. 自动级联学员全息档案与待分班资产池缓存淘汰自愈。
 */
export class ClientClassCoordinator implements ClientClassCoordinatorInterface {
  private readonly inFlightOps = new Set<string>();

  constructor(
    private readonly port: ClassOperationPort = new HttpClassOperationAdapter(),
    private readonly projector: any = studentProjector
  ) {}

  /**
   * 1. 聚合加载班级工作台全景 (Class Workspace)
   * 包含班级元数据、在班学员花名册与完整排课日程
   */
  async loadClassWorkspace(classId: string): Promise<ClassWorkspaceView> {
    const trimmedId = classId !== undefined && classId !== null ? String(classId).trim() : '';
    if (!trimmedId) {
      throw new Error('班级ID不能为空');
    }
    const view = await this.port.fetchClassWorkspace(trimmedId);
    if (!view || !view.id) {
      throw new Error(`未找到班级详情 (ID: ${trimmedId})`);
    }
    view.students = Array.isArray(view.students) ? view.students : [];
    view.schedules = Array.isArray(view.schedules) ? view.schedules : [];
    view.currentStudentCount =
      typeof view.currentStudentCount === 'number'
        ? view.currentStudentCount
        : view.students.length;
    view.capacity = typeof view.capacity === 'number' ? view.capacity : 10;
    view.completedLessons =
      typeof view.completedLessons === 'number'
        ? view.completedLessons
        : view.schedules.filter((s) => s && s.status === 'completed').length;
    view.totalLessons =
      typeof view.totalLessons === 'number' && view.totalLessons > 0
        ? view.totalLessons
        : view.schedules.length;
    if (!view.statusText) {
      view.statusText = (view as any).status === 'completed' ? '已结班' : '已开班';
    }
    return view;
  }

  /**
   * 2. 合规移出在班学员并回退待分班资产池 (ADR-0004 removeStudent)
   * 闭环职责：
   * - 真实穿透网络接缝，触发服务端行级 CAS 锁名额释放与课包解绑；
   * - 并发防重：引入端侧在途锁，杜绝弱网环境下重复并发扣减名额与班级结课冲突；
   * - 网络断层或服务端业务阻断（如学员不存在、课包异常）时安全熔断，不执行假更新；
   * - 服务端持久化落盘成功后，自动驱逐关联学员全息档案缓存与待分班大盘资产池缓存。
   */
  async removeStudent(
    classId: string,
    studentId: string,
    reason?: string
  ): Promise<RemoveStudentResult> {
    const cId = classId !== undefined && classId !== null ? String(classId).trim() : '';
    const sId = studentId !== undefined && studentId !== null ? String(studentId).trim() : '';

    if (!cId) {
      throw new Error('班级ID不能为空');
    }
    if (!sId) {
      throw new Error('学员ID不能为空');
    }

    const opKey = `remove:${cId}:${sId}`;
    if (this.inFlightOps.has(opKey)) {
      throw new Error('当前学员移出操作正在进行中，请勿重复提交');
    }
    if (this.inFlightOps.has(`complete:${cId}`)) {
      throw new Error('当前班级正在结课归档中，禁止移出学员');
    }

    this.inFlightOps.add(opKey);
    try {
      // 2.1 穿透网络接缝（若抛出异常直接透传，守卫数据一致性）
      const result = await this.port.removeStudent({
        classId: cId,
        studentId: sId,
        reason,
      });

      // 2.2 自动驱逐端侧学员全息档案与待分班资产池缓存
      try {
        if (this.projector) {
          if (typeof this.projector.invalidateDossier === 'function') {
            this.projector.invalidateDossier(sId);
          }
          if (typeof this.projector.invalidatePendingAssetPool === 'function') {
            this.projector.invalidatePendingAssetPool();
          } else if (typeof this.projector.clearCache === 'function') {
            this.projector.clearCache();
          }
        }
      } catch (err) {
        console.warn('[ClientClassCoordinator] 移出学员缓存驱逐告警:', err);
      }

      return result;
    } finally {
      this.inFlightOps.delete(opKey);
    }
  }

  /**
   * 3. 正常结课结业并处置在读学员与未来排课 (ADR-0007 completeClass)
   * 闭环职责：
   * - 规范组装学员处置策略 (disposition, 默认回退待分班 fallback_unassigned)；
   * - 并发防重：端侧在途锁拦截重复双击结班，并与学员移出操作互斥；
   * - 规范传递未来排课物理撤销指令 (cancelFutureSchedules: true)；
   * - 自动级联驱逐在班学员档案缓存与待分班资产池；
   * - 解析不可变结构化审计凭据 ClassCompletionReceipt。
   */
  async completeClass(
    classId: string,
    options?: ClassCompletionOptions
  ): Promise<ClassCompletionReceipt> {
    const cId = classId !== undefined && classId !== null ? String(classId).trim() : '';
    if (!cId) {
      throw new Error('班级ID不能为空');
    }

    const opKey = `complete:${cId}`;
    if (this.inFlightOps.has(opKey)) {
      throw new Error('班级结课操作正在进行中，请勿重复提交');
    }

    // 跨操作并发排他：班级内仍有学员移出操作在途中时，阻断结班
    for (const key of this.inFlightOps) {
      if (key.startsWith(`remove:${cId}:`)) {
        throw new Error('当前班级有学员移出操作正在进行中，请稍后结班');
      }
    }

    this.inFlightOps.add(opKey);
    try {
      const normalizedOptions: ClassCompletionOptions = {
        disposition: options?.disposition || { mode: 'fallback_unassigned' },
        cancelFutureSchedules: options?.cancelFutureSchedules !== false,
        remark: options?.remark,
        studentIds: options?.studentIds,
      };

      // 3.1 穿透网络接缝执行结班事务
      const receipt = await this.port.completeClass(cId, normalizedOptions);

      // 3.2 结班后原在班学员课包回退待分班池，淘汰端侧待分班资产池缓存与学员全息档案
      try {
        if (this.projector) {
          if (Array.isArray(options?.studentIds)) {
            for (const rawSid of options.studentIds) {
              const sid = rawSid !== undefined && rawSid !== null ? String(rawSid).trim() : '';
              if (sid && typeof this.projector.invalidateDossier === 'function') {
                this.projector.invalidateDossier(sid);
              }
            }
          }
          if (typeof this.projector.invalidatePendingAssetPool === 'function') {
            this.projector.invalidatePendingAssetPool();
          } else if (typeof this.projector.clearCache === 'function') {
            this.projector.clearCache();
          }
        }
      } catch (err) {
        console.warn('[ClientClassCoordinator] 结班缓存驱逐告警:', err);
      }

      return receipt;
    } finally {
      this.inFlightOps.delete(opKey);
    }
  }

  /**
   * 4. 本地未执行排课日程自愈出清 (syncCancelledSchedules)
   * 业务不变量：
   * - 历史已点名考勤日程 (status: 'completed' 或 actualCount > 0 或 attendances 有记录) 100% 锁死防腐，绝对保留；
   * - 未点名且无出勤排课日程自愈为 'cancelled'，文本设为 '已取消'。
   */
  syncCancelledSchedules(schedules: ClassScheduleItemModel[]): ClassScheduleItemModel[] {
    if (!Array.isArray(schedules)) return [];

    for (const item of schedules) {
      if (item) {
        // ADR-0007 考勤防腐：已完成或已产生考勤人次的课次严禁变更为已取消
        const numActual = typeof item.actualCount === 'number' ? item.actualCount : Number(item.actualCount || 0);
        const hasAttendances = Array.isArray((item as any).attendances) && (item as any).attendances.length > 0;
        const isAttended =
          item.status === 'completed' ||
          numActual > 0 ||
          hasAttendances;

        if (isAttended) {
          item.status = 'completed';
          if (!item.statusText || item.statusText === '未上' || item.statusText === '未开始' || item.statusText === '待上课') {
            item.statusText = '已上';
          }
        } else {
          item.status = 'cancelled';
          item.statusText = '已取消';
        }
      }
    }
    return schedules;
  }
}

/** 默认生产单例 */
export const classCoordinator = new ClientClassCoordinator();
(classCoordinator as any).createCoordinator = (
  port?: ClassOperationPort,
  projector?: any
) => new ClientClassCoordinator(port, projector);
(classCoordinator as any).CoordinatorClass = ClientClassCoordinator;
(classCoordinator as any).FakeClassOperationAdapter = FakeClassOperationAdapter;
(classCoordinator as any).HttpClassOperationAdapter = HttpClassOperationAdapter;
