import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CourseDeliveryEngine } from '../../curriculum/domain/course-delivery.engine';
import {
  SchedulingIntent,
  SchedulingPreview,
  SchedulingReceipt,
  ProjectedScheduleSlot,
  CollisionDetail,
} from './batch-scheduling.types';

@Injectable()
export class BatchSchedulingCoordinator {
  private readonly logger = new Logger(BatchSchedulingCoordinator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryEngine: CourseDeliveryEngine,
  ) {}

  // --------------------------------------------------------------------------
  // 时间与区间辅助函数
  // --------------------------------------------------------------------------

  private parseTimeToMinutes(hhmm: string): number {
    if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) {
      throw new BadRequestException(`时间格式非法: ${hhmm}，预期格式为 HH:mm`);
    }
    const [h, m] = hhmm.split(':').map(Number);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      throw new BadRequestException(`时间数值越界: ${hhmm}`);
    }
    return h * 60 + m;
  }

  private isOverlapping(
    sA: number,
    eA: number,
    sB: number,
    eB: number,
  ): boolean {
    return Math.max(sA, sB) < Math.min(eA, eB);
  }

  private validateTimeWindow(
    startTime: string,
    endTime: string,
  ): { valid: boolean; reason?: string; durationMinutes?: number } {
    const startMin = this.parseTimeToMinutes(startTime);
    const endMin = this.parseTimeToMinutes(endTime);

    if (endMin <= startMin) {
      return { valid: false, reason: '结束时间必须严格晚于起始时间' };
    }

    const DAY_START = 7 * 60; // 07:00 (420)
    const DAY_END = 22 * 60;  // 22:00 (1320)

    if (startMin < DAY_START) {
      return { valid: false, reason: '排课起始时间不得早于 07:00' };
    }
    if (endMin > DAY_END) {
      return {
        valid: false,
        reason: '排课结束时间不得晚于 22:00（严禁跨午夜或超时排课）',
      };
    }

    return { valid: true, durationMinutes: endMin - startMin };
  }

  private getDayOfWeekName(day: number): string {
    const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return names[day] || '';
  }

  // --------------------------------------------------------------------------
  // 核心入口 1: 预演推演 (Dry-Run Preview)
  // --------------------------------------------------------------------------

  async preview(intent: SchedulingIntent): Promise<SchedulingPreview> {
    const timeCheck = this.validateTimeWindow(intent.startTime, intent.endTime);
    if (!timeCheck.valid) {
      throw new BadRequestException(timeCheck.reason);
    }

    // 1. 实体水化与跨校区交付准入核验
    const targetClassIds =
      intent.classIds && intent.classIds.length > 0
        ? intent.classIds
        : [];
    if (targetClassIds.length === 0) {
      throw new BadRequestException('排课意图必须指定至少一个排课目标班级 (classIds)');
    }

    const classes = await this.prisma.class.findMany({
      where: { id: { in: targetClassIds } },
      include: {
        course: true,
        teacher: true,
        classroom: true,
        campus: true,
        studentPackages: {
          where: { status: 'active' },
        },
      },
    });

    if (classes.length !== targetClassIds.length) {
      const foundIds = new Set(classes.map((c) => c.id));
      const missing = targetClassIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`未找到目标班级: ${missing.join(', ')}`);
    }

    // 跨校区交付授权检查 (Delivery Access Invariant)
    for (const cls of classes) {
      const effectiveCampusId = intent.campusId || cls.campusId;
      await this.deliveryEngine.assertDeliveryAccess(cls.courseId, effectiveCampusId);
    }

    // 2. 日期序列推演
    const repeatCount = Math.max(1, Math.min(48, intent.recurrence?.repeatCount || 16));
    const [startY, startM, startD] = intent.startDate.split('-').map(Number);
    const baseDate = new Date(startY, (startM || 1) - 1, startD || 1);

    const projectedDates: Array<{ dateStr: string; dayOfWeekName: string }> = [];
    const excludeSet = new Set(intent.recurrence?.excludeDates || []);

    if (intent.recurrence?.frequency === 'custom' && Array.isArray(intent.recurrence.customDates)) {
      for (const d of intent.recurrence.customDates) {
        if (!excludeSet.has(d)) {
          const [y, m, day] = d.split('-').map(Number);
          const dt = new Date(y, (m || 1) - 1, day || 1);
          projectedDates.push({ dateStr: d, dayOfWeekName: this.getDayOfWeekName(dt.getDay()) });
        }
      }
    } else {
      // 默认为 weekly 规律排课，固定步长 7 天
      let current = new Date(baseDate);
      let collected = 0;
      let safetyCounter = 0;

      while (collected < repeatCount && safetyCounter < 100) {
        safetyCounter++;
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        if (!excludeSet.has(dateStr)) {
          projectedDates.push({
            dateStr,
            dayOfWeekName: this.getDayOfWeekName(current.getDay()),
          });
          collected++;
        }
        current.setDate(current.getDate() + 7);
      }
    }

    // 3. 批量数据单次预热 (Anti-N+1 Prefetcher)
    const distinctDates = Array.from(new Set(projectedDates.map((p) => p.dateStr)));
    const targetCampusId = intent.campusId || classes[0].campusId;

    const existingSchedules = await this.prisma.scheduleEvent.findMany({
      where: {
        campusId: targetCampusId,
        date: { in: distinctDates },
        status: { not: 'cancelled' },
        ...(intent.excludeScheduleId ? { id: { not: intent.excludeScheduleId } } : {}),
      },
      include: {
        teacher: { select: { realName: true } },
        classroom: { select: { name: true, capacity: true } },
        class: { select: { name: true } },
      },
    });

    // 预热关联教室的物理容量字典
    const allClassroomIds = Array.from(
      new Set([
        ...classes.map((c) => intent.classroomId || c.classroomId),
        ...existingSchedules.map((s) => s.classroomId),
      ]),
    );
    const classrooms = await this.prisma.classroom.findMany({
      where: { id: { in: allClassroomIds } },
    });
    const classroomMap = new Map(classrooms.map((c) => [c.id, c]));

    // 4. 三维立体碰撞推演与虚拟课次组装
    const allCollisions: CollisionDetail[] = [];
    const projectedSlots: ProjectedScheduleSlot[] = [];
    let slotCounter = 1;

    const startMin = this.parseTimeToMinutes(intent.startTime);
    const endMin = this.parseTimeToMinutes(intent.endTime);

    // 记录本批次内部新排日程槽位，用于同批自相抢占检测
    const intraBatchSlots: Array<{
      date: string;
      startMin: number;
      endMin: number;
      teacherId: string;
      classroomId: string;
      classId: string;
      className: string;
    }> = [];

    for (let i = 0; i < projectedDates.length; i++) {
      const { dateStr, dayOfWeekName } = projectedDates[i];

      for (const cls of classes) {
        const teacherId = intent.teacherId || cls.teacherId;
        const classroomId = intent.classroomId || cls.classroomId;
        const teacherName =
          cls.teacherId === teacherId
            ? cls.teacher.realName
            : (await this.prisma.user.findUnique({ where: { id: teacherId } }))?.realName || '未知讲师';
        const targetRoom = classroomMap.get(classroomId) || cls.classroom;
        const classroomName = targetRoom?.name || '未知教室';

        const slotConflicts: CollisionDetail[] = [];

        // 4.1 教室容量硬约束校验
        const activeStudentCount = cls.studentPackages.length || cls.currentStudentCount || 0;
        if (targetRoom && targetRoom.capacity && activeStudentCount > targetRoom.capacity) {
          const detail: CollisionDetail = {
            category: 'CLASSROOM_CAPACITY_EXCEEDED',
            date: dateStr,
            startTime: intent.startTime,
            endTime: intent.endTime,
            classId: cls.id,
            className: cls.name,
            classroomId,
            classroomName,
            message: `教室【${classroomName}】容量上限为 ${targetRoom.capacity} 人，但班级【${cls.name}】在读学员为 ${activeStudentCount} 人，超出教室容量上限`,
          };
          slotConflicts.push(detail);
          allCollisions.push(detail);
        }

        // 4.2 既有日程碰撞检查 (讲师、教室、班级)
        const sameDayExisting = existingSchedules.filter((s) => s.date === dateStr);
        for (const existing of sameDayExisting) {
          const exStart = this.parseTimeToMinutes(existing.startTime);
          const exEnd = this.parseTimeToMinutes(existing.endTime);

          if (this.isOverlapping(startMin, endMin, exStart, exEnd)) {
            // 讲师占用
            if (existing.teacherId === teacherId) {
              const detail: CollisionDetail = {
                category: 'TEACHER_CONFLICT',
                date: dateStr,
                startTime: intent.startTime,
                endTime: intent.endTime,
                classId: cls.id,
                className: cls.name,
                teacherId,
                teacherName,
                conflictingScheduleId: existing.id,
                conflictingTitle: existing.class.name,
                message: `讲师【${teacherName}】在时段 ${intent.startTime}-${intent.endTime} 已有授课安排【${existing.class.name}】`,
              };
              slotConflicts.push(detail);
              allCollisions.push(detail);
            }

            // 教室占用
            if (existing.classroomId === classroomId) {
              const detail: CollisionDetail = {
                category: 'CLASSROOM_OCCUPIED',
                date: dateStr,
                startTime: intent.startTime,
                endTime: intent.endTime,
                classId: cls.id,
                className: cls.name,
                classroomId,
                classroomName,
                conflictingScheduleId: existing.id,
                conflictingTitle: existing.class.name,
                message: `教室【${classroomName}】在时段 ${intent.startTime}-${intent.endTime} 已被占用【${existing.class.name}】`,
              };
              slotConflicts.push(detail);
              allCollisions.push(detail);
            }

            // 班级已有日程
            if (existing.classId === cls.id) {
              const detail: CollisionDetail = {
                category: 'CLASS_OVERLAP',
                date: dateStr,
                startTime: intent.startTime,
                endTime: intent.endTime,
                classId: cls.id,
                className: cls.name,
                conflictingScheduleId: existing.id,
                message: `班级【${cls.name}】在时段 ${intent.startTime}-${intent.endTime} 已安排其他课程`,
              };
              slotConflicts.push(detail);
              allCollisions.push(detail);
            }
          }
        }

        // 4.3 同批次内部相互抢占碰撞检测 (Intra-batch Collision)
        for (const otherSlot of intraBatchSlots) {
          if (
            otherSlot.date === dateStr &&
            this.isOverlapping(startMin, endMin, otherSlot.startMin, otherSlot.endMin)
          ) {
            if (otherSlot.teacherId === teacherId && otherSlot.classId !== cls.id) {
              const detail: CollisionDetail = {
                category: 'INTRA_BATCH_COLLISION',
                date: dateStr,
                startTime: intent.startTime,
                endTime: intent.endTime,
                classId: cls.id,
                className: cls.name,
                teacherId,
                teacherName,
                message: `本批次内部发生讲师冲突：班级【${cls.name}】与【${otherSlot.className}】抢占同一位讲师【${teacherName}】`,
              };
              slotConflicts.push(detail);
              allCollisions.push(detail);
            }
            if (otherSlot.classroomId === classroomId && otherSlot.classId !== cls.id) {
              const detail: CollisionDetail = {
                category: 'INTRA_BATCH_COLLISION',
                date: dateStr,
                startTime: intent.startTime,
                endTime: intent.endTime,
                classId: cls.id,
                className: cls.name,
                classroomId,
                classroomName,
                message: `本批次内部发生教室冲突：班级【${cls.name}】与【${otherSlot.className}】抢占同一教室【${classroomName}】`,
              };
              slotConflicts.push(detail);
              allCollisions.push(detail);
            }
          }
        }

        // 登记到同批次日程池
        intraBatchSlots.push({
          date: dateStr,
          startMin,
          endMin,
          teacherId,
          classroomId,
          classId: cls.id,
          className: cls.name,
        });

        // 4.4 自适应泳道分配（贪心染色 0~3）
        const overlappingOnDay = [
          ...sameDayExisting.filter((s) => {
            const sStart = this.parseTimeToMinutes(s.startTime);
            const sEnd = this.parseTimeToMinutes(s.endTime);
            return this.isOverlapping(startMin, endMin, sStart, sEnd);
          }),
          ...intraBatchSlots.filter(
            (b) =>
              b.date === dateStr &&
              b !== intraBatchSlots[intraBatchSlots.length - 1] &&
              this.isOverlapping(startMin, endMin, b.startMin, b.endMin),
          ),
        ];
        const laneIndex = overlappingOnDay.length % 4;

        projectedSlots.push({
          slotIndex: slotCounter++,
          classId: cls.id,
          className: cls.name,
          teacherId,
          teacherName,
          classroomId,
          classroomName,
          date: dateStr,
          dayOfWeek: dayOfWeekName,
          startTime: intent.startTime,
          endTime: intent.endTime,
          durationMinutes: timeCheck.durationMinutes || 90,
          laneIndex,
          hasConflict: slotConflicts.length > 0,
          conflicts: slotConflicts,
          semanticType: slotConflicts.length > 0 ? 'conflict' : 'regular',
        });
      }
    }

    const cleanSlotsCount = projectedSlots.filter((s) => !s.hasConflict).length;
    const conflictSlotsCount = projectedSlots.filter((s) => s.hasConflict).length;
    const startDate = projectedDates[0]?.dateStr || intent.startDate;
    const endDate = projectedDates[projectedDates.length - 1]?.dateStr || intent.startDate;

    return {
      success: true,
      totalPlannedSlots: projectedSlots.length,
      cleanSlotsCount,
      conflictSlotsCount,
      dateRange: {
        startDate,
        endDate,
        totalWeeks: projectedDates.length,
      },
      slots: projectedSlots,
      collisions: allCollisions,
      canCommitStrictly: conflictSlotsCount === 0,
      summaryText: `预演完成：计划为 ${classes.length} 个班级生成 ${projectedSlots.length} 节日程（跨度：${startDate} 至 ${endDate}），探测到 ${conflictSlotsCount} 节存在时段冲突。`,
    };
  }

  // --------------------------------------------------------------------------
  // 核心入口 2: 原子事务持久化 (Transactional Commit)
  // --------------------------------------------------------------------------

  async commit(intent: SchedulingIntent): Promise<SchedulingReceipt> {
    // 1. 先行执行只读预演以取得权威仿真计算结果
    const previewResult = await this.preview(intent);

    const policy = intent.conflictPolicy || 'ALLOW_AND_FLAG';
    if (policy === 'STRICT_ABORT' && previewResult.conflictSlotsCount > 0) {
      throw new BadRequestException(
        `检测到 ${previewResult.conflictSlotsCount} 处排课冲突，STRICT_ABORT 严格策略已终止排课，数据库未写入任何脏数据！请调整时段后再试。`,
      );
    }

    // 2. 在单一 Prisma 事务中原子落盘所有日程实体
    const batchId = `batch-${Date.now()}`;
    const targetCampusId = intent.campusId;

    return this.prisma.$transaction(async (tx) => {
      const createdSchedules: Array<{
        id: string;
        classId: string;
        className: string;
        teacherName: string;
        classroomName: string;
        date: string;
        startTime: string;
        endTime: string;
        laneIndex: number;
        semanticType: string;
      }> = [];

      for (const slot of previewResult.slots) {
        const semanticType = slot.hasConflict ? 'conflict' : (intent.classType || 'regular');

        const record = await tx.scheduleEvent.create({
          data: {
            campusId: targetCampusId,
            classId: slot.classId,
            teacherId: slot.teacherId,
            classroomId: slot.classroomId,
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            semanticType,
            classType: intent.classType || 'formal',
            status: 'scheduled',
            laneIndex: slot.laneIndex,
          },
        });

        createdSchedules.push({
          id: record.id,
          classId: slot.classId,
          className: slot.className,
          teacherName: slot.teacherName,
          classroomName: slot.classroomName,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          laneIndex: slot.laneIndex,
          semanticType,
        });
      }

      this.logger.log(
        `[BatchSchedulingCoordinator] 批量排课提交成功: batchId=${batchId}, 总课次=${createdSchedules.length}, 冲突标记=${previewResult.conflictSlotsCount}`,
      );

      return {
        success: true,
        batchId,
        persistedCount: createdSchedules.length,
        flaggedConflictCount: previewResult.conflictSlotsCount,
        affectedClassIds: intent.classIds,
        schedules: createdSchedules,
        collisions: previewResult.collisions,
        message: `批量排课执行成功！已原子写入 ${createdSchedules.length} 节排课日程，其中 ${previewResult.conflictSlotsCount} 节冲突日程已红标跳动待调解。`,
      };
    });
  }
}
