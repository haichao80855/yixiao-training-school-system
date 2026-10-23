import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  WorkbenchQuery,
  WorkbenchSnapshot,
  RollCallSessionView,
  RollCallStudentView,
  RollCallSubmission,
  SettlementReceipt,
  ReversalReceipt,
  AttendanceHistoryView,
  ScheduleCardView,
  AttendanceStatus,
} from './lesson-settlement.types';

@Injectable()
export class LessonSettlementEngine {
  constructor(private readonly prisma: PrismaService) {}

  public resolvePeriodRange(period?: string, refDate = new Date()): { startDate: string; endDate: string; trendLabels: string[] } | null {
    if (!period || period === 'all') return null;
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const date = refDate.getDate();
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (period === '今日' || period === 'today') {
      const dStr = fmt(refDate);
      return {
        startDate: dStr,
        endDate: dStr,
        trendLabels: ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'],
      };
    }

    if (period === '本周' || period === 'week') {
      const day = refDate.getDay();
      const diffToMon = (day === 0 ? -6 : 1) - day;
      const monday = new Date(refDate);
      monday.setDate(date + diffToMon);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        startDate: fmt(monday),
        endDate: fmt(sunday),
        trendLabels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      };
    }

    if (period === '上月' || period === 'last_month') {
      const prevMonthLastDay = new Date(year, month, 0);
      const prevMonthFirstDay = new Date(year, month - 1, 1);
      return {
        startDate: fmt(prevMonthFirstDay),
        endDate: fmt(prevMonthLastDay),
        trendLabels: ['第1周', '第2周', '第3周', '第4周'],
      };
    }

    if (period === '本年' || period === 'year') {
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        trendLabels: ['02月', '04月', '06月', '08月', '10月', '12月'],
      };
    }

    let targetMonth = month;
    const match = period.match(/^(\d{1,2})月?$/);
    if (match) {
      targetMonth = parseInt(match[1], 10) - 1;
    }
    const firstDay = new Date(year, targetMonth, 1);
    const lastDay = new Date(year, targetMonth + 1, 0);
    return {
      startDate: fmt(firstDay),
      endDate: fmt(lastDay),
      trendLabels: [
        `${pad(targetMonth + 1)}-05`,
        `${pad(targetMonth + 1)}-10`,
        `${pad(targetMonth + 1)}-15`,
        `${pad(targetMonth + 1)}-20`,
        `${pad(targetMonth + 1)}-25`,
        `${pad(targetMonth + 1)}-30`,
      ],
    };
  }

  /**
   * 1. 获取授课工作台完整就绪视图 (一站式获取看板指标、待上课次与历史冲正流水)
   * 彻底消除前端在浏览器端手动 reduce 和 filter 胶水代码
   */
  async getWorkbenchSnapshot(query: WorkbenchQuery): Promise<WorkbenchSnapshot> {
    const todayStr = this.getTodayDateStr();
    let startDate = query.startDate;
    let endDate = query.endDate;
    if (query.period && !startDate && !endDate) {
      const resolved = this.resolvePeriodRange(query.period);
      if (resolved) {
        startDate = resolved.startDate;
        endDate = resolved.endDate;
      }
    }
    const targetDate = query.date || (startDate && endDate && startDate === endDate ? startDate : todayStr);

    // 1. 构建排课日程查询范围
    const scheduleWhere: any = {};
    if (query.campusId && query.campusId !== 'all') {
      scheduleWhere.campusId = query.campusId;
    }
    if (startDate && endDate) {
      scheduleWhere.date = startDate === endDate ? startDate : { gte: startDate, lte: endDate };
    } else {
      scheduleWhere.date = targetDate;
    }
    if (query.teacherId) {
      scheduleWhere.teacherId = query.teacherId;
    }
    if (query.classId) {
      scheduleWhere.classId = query.classId;
    }

    const todaySchedules = await this.prisma.scheduleEvent.findMany({
      where: scheduleWhere,
      include: {
        class: {
          include: {
            course: true,
            studentPackages: {
              where: { status: 'active' },
              select: { studentId: true },
            },
          },
        },
        teacher: true,
        classroom: true,
        attendances: {
          where: { isReversed: false },
        },
        evaluation: {
          select: { id: true, status: true },
        },
      },
      orderBy: [{ startTime: 'asc' }],
    });

    // 2. 构建考勤历史对账流水查询范围
    const attendanceWhere: any = {};
    if (query.campusId && query.campusId !== 'all') {
      attendanceWhere.scheduleEvent = { campusId: query.campusId };
    }
    if (startDate && endDate) {
      attendanceWhere.scheduleEvent = {
        ...(attendanceWhere.scheduleEvent || {}),
        date: startDate === endDate ? startDate : { gte: startDate, lte: endDate },
      };
    }
    if (query.classId) {
      attendanceWhere.scheduleEvent = {
        ...(attendanceWhere.scheduleEvent || {}),
        classId: query.classId,
      };
    }
    if (query.teacherId) {
      attendanceWhere.scheduleEvent = {
        ...(attendanceWhere.scheduleEvent || {}),
        teacherId: query.teacherId,
      };
    }

    const rawAttendances = await this.prisma.attendanceRecord.findMany({
      where: attendanceWhere,
      include: {
        scheduleEvent: {
          include: {
            class: { include: { course: true } },
            teacher: true,
            classroom: true,
          },
        },
        student: true,
        package: { include: { course: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. 服务端折叠聚合：将扁平考勤记录按排课日程（scheduleEventId）聚合成课次级会话账本
    const historyMap = new Map<string, AttendanceHistoryView>();

    for (const record of rawAttendances) {
      const sEvent = record.scheduleEvent;
      if (!sEvent) continue;

      let historyItem = historyMap.get(sEvent.id);
      if (!historyItem) {
        historyItem = {
          id: record.id,
          recordId: record.id,
          scheduleEventId: sEvent.id,
          className: sEvent.class?.name || '未知班级',
          courseName: sEvent.class?.course?.name || '综合课程',
          teacherName: sEvent.teacher?.realName || '主教讲师',
          classroomName: sEvent.classroom?.name || '校区教室',
          date: sEvent.date,
          startTime: sEvent.startTime,
          endTime: sEvent.endTime,
          timeSlot: `${sEvent.startTime} - ${sEvent.endTime}`,
          totalStudents: 0,
          presentCount: 0,
          leaveCount: 0,
          absentCount: 0,
          lateCount: 0,
          deductedLessonsTotal: 0,
          isReversed: true, // 初始为 true，若有任一未冲正则变为 false
          reversalReason: record.reversalReason || undefined,
          reversedAt: record.reversedAt ? record.reversedAt.toISOString() : undefined,
          reversedBy: record.reversedBy || undefined,
          operator: record.operator,
          createdAt: record.createdAt.toISOString(),
          canRevert: false,
          items: [],
        };
        historyMap.set(sEvent.id, historyItem);
      }

      // 统计课次出勤人次与课消课时
      historyItem.totalStudents += 1;
      if (record.status === 'present') historyItem.presentCount += 1;
      else if (record.status === 'leave') historyItem.leaveCount += 1;
      else if (record.status === 'absent') historyItem.absentCount += 1;
      else if (record.status === 'late') historyItem.lateCount += 1;

      if (!record.isReversed) {
        historyItem.deductedLessonsTotal += record.deductLessons;
        historyItem.isReversed = false;
      }

      historyItem.items.push({
        id: record.id,
        studentId: record.studentId,
        studentName: record.student?.name || '在读学员',
        studentNo: record.student?.studentNo || '-',
        status: record.status as AttendanceStatus,
        deductLessons: record.deductLessons,
        packageId: record.packageId,
        regularBurned: record.regularBurned || 0,
        bonusBurned: record.bonusBurned || 0,
        score: record.score,
        rating: record.rating,
        comment: record.comment,
        isReversed: record.isReversed,
      });
    }

    const history = Array.from(historyMap.values()).map((h) => {
      h.canRevert = !h.isReversed && h.deductedLessonsTotal > 0;
      return h;
    });

    // 4. 组装待上课次卡片模型
    const schedules: ScheduleCardView[] = todaySchedules.map((s) => {
      const studentIds = s.class?.studentPackages?.map((p) => p.studentId) || [];
      const signedCount = s.attendances.filter(
        (a) => a.status === 'present' || a.status === 'late',
      ).length;

      return {
        id: s.id,
        className: s.class?.name || '常规教学班',
        courseName: s.class?.course?.name || '标准课程',
        teacherId: s.teacherId,
        teacherName: s.teacher?.realName || '带班讲师',
        classroomId: s.classroomId,
        classroomName: s.classroom?.name || '教学教室',
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        timeSlot: `${s.startTime} - ${s.endTime}`,
        studentCount: studentIds.length,
        signedCount,
        attendanceCount: signedCount,
        status: s.status,
        semanticType: s.semanticType,
        canRollCall: s.status === 'scheduled',
        studentIds,
        evaluationStatus: (s as any).evaluation?.status || 'none',
      };
    });

    // 5. 权威计算当日 5 大看板指标
    const scheduledCount = todaySchedules.filter((s) => s.status === 'scheduled').length;
    const completedCount = todaySchedules.filter((s) => s.status === 'completed').length;
    const totalStudents = todaySchedules.reduce(
      (sum, s) => sum + (s.class?.studentPackages?.length || 0),
      0,
    );
    const presentStudents = todaySchedules.reduce(
      (sum, s) =>
        sum +
        s.attendances.filter((a) => a.status === 'present' || a.status === 'late').length,
      0,
    );

    // 历史累计课消学时与消课金额计算
    let totalDeductedLessons = 0;
    let totalConsumptionAmount = 0;
    let regularConsumptionAmount = 0;
    let expandConsumptionAmount = 0;
    let regularLessons = 0;
    let expandLessons = 0;

    for (const record of rawAttendances) {
      if (record.isReversed) continue;
      const dLessons = record.deductLessons || 1;
      totalDeductedLessons += dLessons;
      const pPrice = (record as any).package?.pricePerLesson || (record.scheduleEvent?.class as any)?.course?.pricePerLesson || 120;
      const amt = dLessons * pPrice;
      totalConsumptionAmount += amt;
      const isRegular = (record.scheduleEvent?.class as any)?.course?.attribute === 'regular';
      if (isRegular) {
        regularConsumptionAmount += amt;
        regularLessons += dLessons;
      } else {
        expandConsumptionAmount += amt;
        expandLessons += dLessons;
      }
    }

    return {
      campusId: query.campusId,
      date: targetDate,
      metrics: {
        scheduledCount,
        completedCount,
        totalStudents,
        presentStudents,
        totalDeductedLessons,
        regularLessons,
        expandLessons,
        consumptionAmount: totalConsumptionAmount,
        consumptionRegularAmount: regularConsumptionAmount,
        consumptionExpandAmount: expandConsumptionAmount,
      },
      schedules,
      history,
    };
  }

  /**
   * 2. 准备点名会话 (自动注入精确 packageId、预置全勤到课态、标记余额低额预警)
   */
  async prepareRollCallSession(scheduleEventId: string): Promise<RollCallSessionView> {
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: scheduleEventId },
      include: {
        class: {
          include: {
            course: true,
            studentPackages: {
              where: { status: 'active' },
              include: {
                student: {
                  select: {
                    id: true,
                    studentNo: true,
                    name: true,
                    phone: true,
                    gender: true,
                  },
                },
              },
            },
          },
        },
        teacher: true,
        classroom: true,
        attendances: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException(`未找到排课日程 ID: ${scheduleEventId}`);
    }

    const attendanceMap = new Map(schedule.attendances.map((a) => [a.studentId, a]));

    const students: RollCallStudentView[] = schedule.class.studentPackages.map((pkg) => {
      const recorded = attendanceMap.get(pkg.studentId);
      const attendanceStatus = (recorded ? recorded.status : 'present') as AttendanceStatus;
      const isLowBalance = pkg.remainingLessons <= 3;
      const deductLessons =
        attendanceStatus === 'present' || attendanceStatus === 'late'
          ? recorded?.deductLessons ?? 1
          : 0;

      return {
        studentId: pkg.student.id,
        studentNo: pkg.student.studentNo,
        name: pkg.student.name,
        studentName: pkg.student.name,
        phone: pkg.student.phone,
        gender: pkg.student.gender || undefined,
        packageId: pkg.id,
        remainingLessons: pkg.remainingLessons,
        bonusLessons: pkg.bonusLessons,
        totalLessons: pkg.totalLessons,
        isLowBalance,
        attendanceStatus,
        status: attendanceStatus,
        isRecorded: !!recorded,
        score: recorded ? recorded.score : null,
        rating: recorded ? recorded.rating : null,
        comment: recorded?.comment || '',
        remark: recorded?.comment || '',
        deductLessons,
        deductionLessons: deductLessons,
      };
    });

    const defaultPresentCount = students.filter(
      (s) => s.attendanceStatus === 'present' || s.attendanceStatus === 'late',
    ).length;
    const estimatedDeductLessons = students.reduce((sum, s) => sum + s.deductLessons, 0);

    return {
      scheduleEventId: schedule.id,
      classId: schedule.classId,
      className: schedule.class.name,
      courseId: schedule.class.courseId,
      courseName: schedule.class.course.name,
      teacherId: schedule.teacherId,
      teacherName: schedule.teacher?.realName || '主教讲师',
      classroomId: schedule.classroomId,
      classroomName: schedule.classroom?.name || '上课教室',
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      timeSlot: `${schedule.startTime} - ${schedule.endTime}`,
      status: schedule.status,
      canSettle: schedule.status !== 'completed',
      students,
      summary: {
        totalStudents: students.length,
        defaultPresentCount,
        estimatedDeductLessons,
      },
    };
  }

  /**
   * 3. 原子随堂点名消课结算
   * 绑定精确 packageId、支持正赠课时明细记录、更新排课状态为 completed
   */
  async settleRollCall(
    submission: RollCallSubmission,
    operator: string,
  ): Promise<SettlementReceipt> {
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: submission.scheduleEventId },
      include: {
        class: true,
        attendances: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException(`未找到排课日程 ${submission.scheduleEventId}`);
    }

    if (schedule.status === 'completed') {
      throw new BadRequestException('该排课日程已点名结课，如需变更请先执行反结课冲正');
    }

    return this.prisma.$transaction(async (tx) => {
      const details: SettlementReceipt['details'] = [];
      let totalDeductedLessons = 0;
      let regularLessonsBurned = 0;
      let bonusLessonsBurned = 0;
      let presentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;
      let absentCount = 0;

      for (const item of submission.items) {
        if (item.status === 'present') presentCount += 1;
        else if (item.status === 'late') lateCount += 1;
        else if (item.status === 'leave') leaveCount += 1;
        else if (item.status === 'absent') absentCount += 1;

        const isDeductible = item.status === 'present' || item.status === 'late';
        const requestedDeduct =
          item.deductLessons !== undefined ? Number(item.deductLessons) : 1;
        const actualDeduct = isDeductible ? requestedDeduct : 0;

        let targetPkg: any = null;
        let itemRegularBurned = 0;
        let itemBonusBurned = 0;

        // 1. 如果需要扣课时，寻找确切的出账课包
        if (actualDeduct > 0) {
          if (item.packageId) {
            // 指定课包也必须是在读状态：已冻结 (停课) 或已退费的课包不能被扣课，
            // 否则下面的状态写回会把冻结课包改回 active
            targetPkg = await tx.studentCoursePackage.findFirst({
              where: {
                id: item.packageId,
                studentId: item.studentId,
                courseId: schedule.class.courseId,
                status: 'active',
              },
            });
          }

          // 若未传 packageId 或未匹配到，安全回退到该学员在该课程下的有效激活课包 (FIFO 按建立时间排序)
          if (!targetPkg) {
            targetPkg = await tx.studentCoursePackage.findFirst({
              where: {
                studentId: item.studentId,
                courseId: schedule.class.courseId,
                status: 'active',
              },
              orderBy: { createdAt: 'asc' },
            });
          }

          if (targetPkg) {
            // 盛通资产风控规则：区分实缴正课与赠课消耗
            // 正课优先消耗算法：优先扣减实付正课 (remainingLessons - bonusLessons)，保留不可折现的赠课
            const regularRemaining = Math.max(0, targetPkg.remainingLessons - targetPkg.bonusLessons);
            if (regularRemaining >= actualDeduct) {
              itemRegularBurned = actualDeduct;
              itemBonusBurned = 0;
            } else {
              itemRegularBurned = regularRemaining;
              itemBonusBurned = actualDeduct - regularRemaining;
            }

            // 原子级更新课包余额
            const updatedPkg = await tx.studentCoursePackage.update({
              where: { id: targetPkg.id },
              data: {
                remainingLessons: { decrement: actualDeduct },
                consumedLessons: { increment: actualDeduct },
                // 若剩余课时已扣完，标记为 completed，否则保持 active
                status: targetPkg.remainingLessons - actualDeduct <= 0 ? 'completed' : 'active',
              },
            });

            totalDeductedLessons += actualDeduct;
            regularLessonsBurned += itemRegularBurned;
            bonusLessonsBurned += itemBonusBurned;

            details.push({
              studentId: item.studentId,
              packageId: targetPkg.id,
              deductLessons: actualDeduct,
              regularBurned: itemRegularBurned,
              bonusBurned: itemBonusBurned,
              remainingAfter: updatedPkg.remainingLessons,
            });
          }
        }

        // 2. 落库考勤履约记录 AttendanceRecord
        // 先写课评草稿、后点名时，课评流程已为学员建立了未扣课的考勤记录：此处更新该记录，
        // 不再新建第二条 (否则同一学员同一课次会出现两条有效考勤，家长端课评流与课时明细重复)
        const attendanceData = {
          packageId: targetPkg ? targetPkg.id : null,
          status: item.status,
          deductLessons: actualDeduct,
          regularBurned: itemRegularBurned,
          bonusBurned: itemBonusBurned,
          comment: item.comment || null,
          score: item.score !== undefined ? Number(item.score) : null,
          rating: item.rating || null,
          operator,
        };
        const existingAttendance = schedule.attendances.find(
          (a) => a.studentId === item.studentId && !a.isReversed,
        );
        if (existingAttendance) {
          await tx.attendanceRecord.update({
            where: { id: existingAttendance.id },
            data: attendanceData,
          });
        } else {
          await tx.attendanceRecord.create({
            data: {
              scheduleEventId: schedule.id,
              studentId: item.studentId,
              isReversed: false,
              ...attendanceData,
            },
          });
        }
      }

      // 3. 更新排课日程状态为 completed，语义类型更新为 completed (盛通绿色标签)
      await tx.scheduleEvent.update({
        where: { id: schedule.id },
        data: {
          status: 'completed',
          semanticType: 'completed',
        },
      });

      return {
        success: true,
        scheduleEventId: schedule.id,
        completedCount: submission.items.length,
        totalDeductedLessons,
        regularLessonsBurned,
        bonusLessonsBurned,
        summary: {
          totalStudents: submission.items.length,
          presentCount,
          leaveCount,
          absentCount,
          lateCount,
          totalLessonsDeducted: totalDeductedLessons,
        },
        details,
        message: `随堂点名消课成功！已结算 ${submission.items.length} 名学员，扣减 ${totalDeductedLessons} 课时`,
      };
    });
  }

  /**
   * 4. 盛通反结课 / 撤销点名冲正机制 (防重放与课时原路退还)
   * 按当初扣减的 packageId 原路返还原课包，杜绝跨课包串账
   */
  async reverseRollCall(
    scheduleEventId: string,
    operator: string,
    reason?: string,
  ): Promise<ReversalReceipt> {
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: scheduleEventId },
      include: {
        class: true,
        attendances: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException(`未找到排课日程 ${scheduleEventId}`);
    }

    if (schedule.attendances.length === 0) {
      throw new BadRequestException('该日程尚未点名，无需反结课冲正');
    }

    // 检查是否已经全被冲正 (防重放攻击与课时虚增)
    const activeAttendances = schedule.attendances.filter((a) => !a.isReversed);
    if (activeAttendances.length === 0) {
      throw new BadRequestException('该排课日程的点名记录已被冲正，严禁重复反结课（抵御重放刷课）');
    }

    return this.prisma.$transaction(async (tx) => {
      let refundedLessonTotal = 0;
      let refundedRegularTotal = 0;
      let refundedBonusTotal = 0;
      const details: ReversalReceipt['details'] = [];

      for (const att of activeAttendances) {
        // 只退还真正落到课包上的课时：点名时无在读课包、或课评草稿预建的考勤记录虽有扣课数，但从未扣减课包
        const wasCharged = !!att.packageId || (att.regularBurned || 0) + (att.bonusBurned || 0) > 0;
        if (att.deductLessons > 0 && wasCharged) {
          // 精确查找当初出账扣款的原课包
          let pkg: any = null;
          if (att.packageId) {
            pkg = await tx.studentCoursePackage.findUnique({
              where: { id: att.packageId },
            });
          }

          // 兼容历史未记录 packageId 的遗留记录
          if (!pkg) {
            pkg = await tx.studentCoursePackage.findFirst({
              where: {
                studentId: att.studentId,
                courseId: schedule.class.courseId,
              },
            });
          }

          if (pkg) {
            // 核心财务防腐屏障 (ACB)：严禁复活已退费课包 (RefundLocked Guard)
            if (pkg.status === 'refunded') {
              throw new ConflictException(
                `【财务防腐屏障拦截】课包 [${pkg.id}] 已完成退费归档（RefundLocked），严禁通过反结课冲正将其错误复活为 active 状态！`,
              );
            }

            // 原路退还课时并安全复苏课包状态 (仅在读与完结课包才恢复 active)
            const nextStatus = pkg.status === 'frozen' ? 'frozen' : 'active';
            const updatedPkg = await tx.studentCoursePackage.update({
              where: { id: pkg.id },
              data: {
                remainingLessons: { increment: att.deductLessons },
                consumedLessons: { decrement: att.deductLessons },
                status: nextStatus,
              },
            });

            refundedLessonTotal += att.deductLessons;
            refundedRegularTotal += att.regularBurned || att.deductLessons;
            refundedBonusTotal += att.bonusBurned || 0;

            details.push({
              studentId: att.studentId,
              packageId: pkg.id,
              refundedLessons: att.deductLessons,
              remainingAfter: updatedPkg.remainingLessons,
            });
          }
        }

        // 打上不可逆冲正标记与操作人审计痕迹
        await tx.attendanceRecord.update({
          where: { id: att.id },
          data: {
            isReversed: true,
            reversedAt: new Date(),
            reversedBy: operator,
            reversalReason: reason || '教务反结课冲正退还课时',
            comment: att.comment
              ? `${att.comment} [已由 ${operator} 执行反结课冲正]`
              : `[已由 ${operator} 执行反结课冲正]`,
          },
        });
      }

      // 排课日程状态回滚为 scheduled，语义类型恢复为常规蓝 regular
      await tx.scheduleEvent.update({
        where: { id: schedule.id },
        data: {
          status: 'scheduled',
          semanticType: 'regular',
        },
      });

      return {
        success: true,
        scheduleEventId,
        reversedCount: activeAttendances.length,
        refundedLessons: refundedLessonTotal,
        refundedRegularLessons: refundedRegularTotal,
        refundedBonusLessons: refundedBonusTotal,
        details,
        message: `反结课冲正成功！已回滚 ${activeAttendances.length} 条点名记录，原路退还 ${refundedLessonTotal} 课时`,
      };
    });
  }

  private getTodayDateStr(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
