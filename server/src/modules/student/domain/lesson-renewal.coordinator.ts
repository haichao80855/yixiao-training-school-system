import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  RENEWAL_RISK_CONSTANTS,
  StudentRiskDiagnosis,
  RenewalRosterQuery,
  CampusRenewalRosterResult,
  ClassRosterHealthReport,
  ClassRosterStudentHealth,
  RenewalDraftOptions,
  RenewalOrderDraft,
  RenewalWarningLevel,
  DormantRiskLevel,
  RenewalActionAdvice,
  VisualHealthBadge,
} from './lesson-renewal.types';
import { RefundLockedException } from '../../educational/domain/learning-growth.types';

@Injectable()
export class LessonRenewalCoordinator {
  private readonly logger = new Logger(LessonRenewalCoordinator.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 辅助方法：生成权威视觉语义徽章 (SSOT Visual Badge)
   */
  private resolveVisualBadge(warningLevel: RenewalWarningLevel): VisualHealthBadge {
    switch (warningLevel) {
      case 'critical':
        return {
          level: 'critical',
          color: 'danger',
          type: 'danger',
          label: '紧急枯竭 (<=4课时)',
          text: '紧急枯竭 (<=4课时)',
          cssClass: 'text-rose-600 font-bold bg-rose-50 border border-rose-200',
        };
      case 'warning':
        return {
          level: 'warning',
          color: 'warning',
          type: 'warning',
          label: '预警关注 (<=8课时)',
          text: '预警关注 (<=8课时)',
          cssClass: 'text-amber-600 font-semibold bg-amber-50 border border-amber-200',
        };
      case 'normal':
      default:
        return {
          level: 'normal',
          color: 'success',
          type: 'success',
          label: '健康在读',
          text: '健康在读',
          cssClass: 'text-emerald-600 font-medium bg-emerald-50 border border-emerald-200',
        };
    }
  }

  /**
   * 1. 单学员课消风控全景诊断 (Single Student Comprehensive Diagnosis)
   * 闭环业务不变量：
   * - 滑动 30 天周均消课流速模型 (自动清洗 isReversed=true 冲正干扰)
   * - 消除 3/4/8 魔法数字，严格应用常量阈值
   * - 停消休眠双向探测 (无出勤天数 + 未来 14 天排课逆向核查)
   * - 财务防腐退费锁定探测 (ACB Guard)
   */
  async diagnoseStudentRisk(
    studentId: string,
    options?: { windowDays?: number },
  ): Promise<StudentRiskDiagnosis> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        campus: true,
        wallet: true,
        packages: {
          where: { status: { in: ['active', 'frozen', 'refunded', 'completed'] } },
          include: { course: true, class: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员档案 (ID: ${studentId})`);
    }

    const windowDays = options?.windowDays || RENEWAL_RISK_CONSTANTS.SLIDING_BURN_WINDOW_DAYS;
    const sinceDate = new Date(Date.now() - windowDays * 86400000);

    // 1. 获取近 windowDays 天内非冲正考勤记录
    const attendances = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId: student.id,
        isReversed: false,
        createdAt: { gte: sinceDate },
      },
      include: { scheduleEvent: true },
      orderBy: { createdAt: 'desc' },
    });

    // 2. 统计课包资产 (仅 active 与 frozen 计入有效未耗尽课时)
    const validPackages = student.packages.filter(
      (p) => p.status === 'active' || p.status === 'frozen',
    );
    const totalRemaining = validPackages.reduce((sum, p) => sum + p.remainingLessons, 0);
    const totalConsumed = student.packages.reduce((sum, p) => sum + p.consumedLessons, 0);

    // 3. 计算滑动消课流速与耗尽预测
    const burnedLessonsInWindow = attendances.reduce((sum, a) => sum + a.deductLessons, 0);
    const effectiveWeeks = Math.max(1, windowDays / 7);
    const calculatedRate = burnedLessonsInWindow / effectiveWeeks;
    // 若窗口内有消课按实际算，若完全无消课则保底 0.0 并标记休眠
    const weeklyBurnRate = Number(calculatedRate.toFixed(1));
    const dailyBurnRate = weeklyBurnRate > 0 ? weeklyBurnRate / 7 : 0;
    const estimatedDepletionDays =
      dailyBurnRate > 0 ? Math.round(totalRemaining / dailyBurnRate) : 999;

    const estimatedDepletionDate =
      estimatedDepletionDays < 999
        ? new Date(Date.now() + estimatedDepletionDays * 86400000).toISOString().split('T')[0]
        : '暂无消课计划';

    // 4. 消除魔法数字：应用全局 SSOT 预警判定
    let warningLevel: RenewalWarningLevel = 'normal';
    if (totalRemaining <= RENEWAL_RISK_CONSTANTS.CRITICAL_LESSONS_THRESHOLD) {
      warningLevel = 'critical';
    } else if (totalRemaining <= RENEWAL_RISK_CONSTANTS.WARNING_LESSONS_THRESHOLD) {
      warningLevel = 'warning';
    }
    const visualBadge = this.resolveVisualBadge(warningLevel);

    // 5. 停消休眠双向探测 (向前看距今最后出勤天数，向后看未来排课)
    const lastAtt = attendances[0];
    const lastAttendanceDate = lastAtt ? lastAtt.createdAt.toISOString().split('T')[0] : null;
    const inactiveDays = lastAtt
      ? Math.floor((Date.now() - lastAtt.createdAt.getTime()) / 86400000)
      : Math.floor((Date.now() - student.createdAt.getTime()) / 86400000);

    // 探测未来 14 天是否有排课
    const futureTwoWeeksDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    const todayDate = new Date().toISOString().split('T')[0];
    const activeClassIds = validPackages
      .map((p) => p.classId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    let futureSchedulesCount = 0;
    if (activeClassIds.length > 0) {
      futureSchedulesCount = await this.prisma.scheduleEvent.count({
        where: {
          classId: { in: activeClassIds },
          date: { gte: todayDate, lte: futureTwoWeeksDate },
          status: 'scheduled',
        },
      });
    }

    let dormantRisk: DormantRiskLevel = 'active';
    if (inactiveDays >= RENEWAL_RISK_CONSTANTS.DORMANT_SEVERE_DAYS) {
      dormantRisk = 'dormant_severe';
    } else if (
      inactiveDays >= RENEWAL_RISK_CONSTANTS.DORMANT_INACTIVITY_DAYS &&
      futureSchedulesCount === 0
    ) {
      dormantRisk = 'dormant_warning';
    }

    // 6. 财务防腐屏障 (ACB) 退费锁定核验
    const hasRefundedPkg = student.packages.some((p) => p.status === 'refunded');
    const pendingRefundOrder = await this.prisma.order.findFirst({
      where: {
        studentId: student.id,
        orderType: 'refund',
        status: 'unpaid',
      },
    });
    const isRefundLocked = hasRefundedPkg || !!pendingRefundOrder;

    // 智能选取需续报目标课包 (优先取剩余课时最少的在读课包)
    const activePackages = student.packages.filter((p) => p.status === 'active');
    const targetPkg = [...activePackages].sort(
      (a, b) => a.remainingLessons - b.remainingLessons,
    )[0];

    const renewalWindowOpen =
      totalRemaining <= RENEWAL_RISK_CONSTANTS.WARNING_LESSONS_THRESHOLD ||
      estimatedDepletionDays <= RENEWAL_RISK_CONSTANTS.RENEWAL_WINDOW_DAYS;

    let advice: RenewalActionAdvice = 'HEALTHY_LEARNING';
    if (isRefundLocked) {
      advice = 'BLOCKED_REFUNDING';
    } else if (warningLevel === 'critical') {
      advice = 'URGENT_RENEWAL';
    } else if (dormantRisk !== 'active') {
      advice = 'DORMANT_FOLLOWUP';
    } else if (renewalWindowOpen) {
      advice = 'WINDOW_OPEN';
    }

    return {
      studentId: student.id,
      studentNo: student.studentNo,
      studentName: student.name,
      phone: student.phone,
      campusId: student.campusId,
      campusName: student.campus?.name || '总部校区',
      currentStatus: student.status,
      assetSummary: {
        totalRemainingLessons: totalRemaining,
        totalConsumedLessons: totalConsumed,
        activePackageCount: activePackages.length,
        principalBalance: student.wallet?.principalBalance || 0,
        bonusBalance: student.wallet?.bonusBalance || 0,
      },
      consumptionHealth: {
        weeklyBurnRate,
        dailyBurnRate,
        estimatedDepletionDays,
        estimatedDepletionDate,
        warningLevel,
        visualBadge,
        lastAttendanceDate,
        inactiveDays,
        dormantRisk,
        futureScheduledLessons: futureSchedulesCount,
      },
      decision: {
        renewalWindowOpen,
        advice,
        targetPackageId: targetPkg?.id || null,
        targetCourseId: targetPkg?.courseId || null,
        targetCourseName: targetPkg?.course?.name || null,
        isRefundLocked,
        blockingReason: isRefundLocked
          ? '该学员名下存在已退费或在途审批退费单，已被财务防腐屏障锁定'
          : undefined,
      },
    };
  }

  /**
   * 2. 学管校区级批量看护大盘 (Campus Renewal Roster - High Performance Batch)
   * 闭环业务不变量：
   * - 单次拉取 30 天考勤，内存 Map 分组汇聚，杜绝 N+1 查询
   * - 统计紧急枯竭、预警跟进、休眠流失与续费窗口开放学员总数
   * - 支持多条件过滤与排序
   */
  async getCampusRenewalRoster(
    campusId: string,
    query: RenewalRosterQuery,
  ): Promise<CampusRenewalRosterResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 20);

    const where: any = { status: { not: 'dropped_out' } };
    if (campusId && campusId !== 'all') {
      where.campusId = campusId;
    }
    if (query.classId) {
      where.packages = { some: { classId: query.classId, status: 'active' } };
    }
    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword } },
        { phone: { contains: query.keyword } },
        { studentNo: { contains: query.keyword } },
      ];
    }

    // 1. 批量加载学员
    const students = await this.prisma.student.findMany({
      where,
      include: {
        campus: true,
        wallet: true,
        packages: {
          where: { status: 'active' },
          include: { course: true, class: true },
        },
      },
    });

    const studentIds = students.map((s) => s.id);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    // 2. 一次性批量拉取近 30 天考勤记录，内存分组映射
    const allAttendances = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId: { in: studentIds },
        isReversed: false,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        studentId: true,
        deductLessons: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const attendanceMap = new Map<string, typeof allAttendances>();
    for (const att of allAttendances) {
      const list = attendanceMap.get(att.studentId) || [];
      list.push(att);
      attendanceMap.set(att.studentId, list);
    }

    let criticalCount = 0;
    let warningCount = 0;
    let normalCount = 0;
    let dormantCount = 0;
    let windowOpenCount = 0;

    const diagnoses: StudentRiskDiagnosis[] = [];

    for (const stu of students) {
      const totalRemaining = stu.packages.reduce((sum, p) => sum + p.remainingLessons, 0);
      const totalConsumed = stu.packages.reduce((sum, p) => sum + p.consumedLessons, 0);
      const stuAtts = attendanceMap.get(stu.id) || [];

      const burnedInWindow = stuAtts.reduce((sum, a) => sum + a.deductLessons, 0);
      const weeklyBurnRate = Number(Math.max(0.0, burnedInWindow / 4.2).toFixed(1));
      const dailyBurnRate = weeklyBurnRate > 0 ? weeklyBurnRate / 7 : 0;
      const estimatedDepletionDays =
        dailyBurnRate > 0 ? Math.round(totalRemaining / dailyBurnRate) : 999;
      const estimatedDepletionDate =
        estimatedDepletionDays < 999
          ? new Date(Date.now() + estimatedDepletionDays * 86400000).toISOString().split('T')[0]
          : '暂无消课';

      let warningLevel: RenewalWarningLevel = 'normal';
      if (totalRemaining <= RENEWAL_RISK_CONSTANTS.CRITICAL_LESSONS_THRESHOLD) {
        warningLevel = 'critical';
        criticalCount++;
      } else if (totalRemaining <= RENEWAL_RISK_CONSTANTS.WARNING_LESSONS_THRESHOLD) {
        warningLevel = 'warning';
        warningCount++;
      } else {
        normalCount++;
      }
      const visualBadge = this.resolveVisualBadge(warningLevel);

      const lastAtt = stuAtts[0];
      const inactiveDays = lastAtt
        ? Math.floor((Date.now() - lastAtt.createdAt.getTime()) / 86400000)
        : Math.floor((Date.now() - stu.createdAt.getTime()) / 86400000);
      let dormantRisk: DormantRiskLevel = 'active';
      if (inactiveDays >= RENEWAL_RISK_CONSTANTS.DORMANT_INACTIVITY_DAYS) {
        dormantRisk = 'dormant_warning';
        dormantCount++;
      }

      const renewalWindowOpen = totalRemaining <= 8 || estimatedDepletionDays <= 30;
      if (renewalWindowOpen) windowOpenCount++;

      const targetPkg = stu.packages[0];

      diagnoses.push({
        studentId: stu.id,
        studentNo: stu.studentNo,
        studentName: stu.name,
        phone: stu.phone,
        campusId: stu.campusId,
        campusName: stu.campus?.name || '总部校区',
        currentStatus: stu.status,
        assetSummary: {
          totalRemainingLessons: totalRemaining,
          totalConsumedLessons: totalConsumed,
          activePackageCount: stu.packages.length,
          principalBalance: stu.wallet?.principalBalance || 0,
          bonusBalance: stu.wallet?.bonusBalance || 0,
        },
        consumptionHealth: {
          weeklyBurnRate,
          dailyBurnRate,
          estimatedDepletionDays,
          estimatedDepletionDate,
          warningLevel,
          visualBadge,
          lastAttendanceDate: lastAtt ? lastAtt.createdAt.toISOString().split('T')[0] : null,
          inactiveDays,
          dormantRisk,
          futureScheduledLessons: 0,
        },
        decision: {
          renewalWindowOpen,
          advice:
            warningLevel === 'critical'
              ? 'URGENT_RENEWAL'
              : renewalWindowOpen
                ? 'WINDOW_OPEN'
                : 'HEALTHY_LEARNING',
          targetPackageId: targetPkg?.id || null,
          targetCourseId: targetPkg?.courseId || null,
          targetCourseName: targetPkg?.course?.name || null,
          isRefundLocked: false,
        },
      });
    }

    // 内存条件过滤
    let filtered = diagnoses;
    const effectiveRiskLevel = query.riskLevel || (query.warningLevel as any);
    if (effectiveRiskLevel && effectiveRiskLevel !== 'all') {
      if (effectiveRiskLevel === 'dormant') {
        filtered = filtered.filter((d) => d.consumptionHealth.dormantRisk !== 'active');
      } else {
        filtered = filtered.filter((d) => d.consumptionHealth.warningLevel === effectiveRiskLevel);
      }
    }
    if (query.dormantOnly) {
      filtered = filtered.filter((d) => d.consumptionHealth.dormantRisk !== 'active');
    }
    if (query.renewalWindowOnly) {
      filtered = filtered.filter((d) => d.decision.renewalWindowOpen);
    }

    // 排序
    if (query.sortBy === 'remaining_lessons' || query.sortBy === 'remaining') {
      filtered.sort((a, b) =>
        query.sortOrder === 'desc'
          ? b.assetSummary.totalRemainingLessons - a.assetSummary.totalRemainingLessons
          : a.assetSummary.totalRemainingLessons - b.assetSummary.totalRemainingLessons,
      );
    } else if (query.sortBy === 'inactive_days') {
      filtered.sort((a, b) =>
        query.sortOrder === 'asc'
          ? a.consumptionHealth.inactiveDays - b.consumptionHealth.inactiveDays
          : b.consumptionHealth.inactiveDays - a.consumptionHealth.inactiveDays,
      );
    } else {
      // 默认按预计耗尽天数由近及远排序 (涵盖 'depletion_days', 'risk', 'urgency')
      filtered.sort(
        (a, b) =>
          a.consumptionHealth.estimatedDepletionDays - b.consumptionHealth.estimatedDepletionDays,
      );
    }

    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    return {
      total: filtered.length,
      page,
      pageSize,
      statistics: {
        criticalCount,
        warningCount,
        normalCount,
        dormantCount,
        windowOpenCount,
      },
      list: paginated,
    };
  }

  /**
   * 3. 班级花名册学员健康视图 (Class Roster Health View - Replace <= 3 Magic Numbers)
   * 闭环业务不变量：
   * - 彻底废除前端 <= 3 魔法数字，下发权威 visualBadge
   * - 加权计算全班综合消课健康指数 classHealthIndex [0-100]
   */
  async getClassRosterHealth(classId: string): Promise<ClassRosterHealthReport> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        course: true,
        teacher: true,
        studentPackages: {
          where: { status: 'active' },
          include: { student: true, course: true },
        },
      },
    });

    if (!cls) {
      throw new NotFoundException(`未找到实体班级档案 (ID: ${classId})`);
    }

    const roster: ClassRosterStudentHealth[] = [];
    let criticalCount = 0;
    let warningCount = 0;
    let normalCount = 0;
    let dormantCount = 0;

    const studentIds = cls.studentPackages
      .map((p) => p.studentId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    // 批量加载该班学员最近考勤
    const recentAttendances = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId: { in: studentIds },
        isReversed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    const studentLastAttMap = new Map<string, Date>();
    for (const att of recentAttendances) {
      if (!studentLastAttMap.has(att.studentId)) {
        studentLastAttMap.set(att.studentId, att.createdAt);
      }
    }

    for (const pkg of cls.studentPackages) {
      const stu = pkg.student;
      if (!stu) continue;

      const remaining = pkg.remainingLessons;
      let warningLevel: RenewalWarningLevel = 'normal';
      if (remaining <= RENEWAL_RISK_CONSTANTS.CRITICAL_LESSONS_THRESHOLD) {
        warningLevel = 'critical';
        criticalCount++;
      } else if (remaining <= RENEWAL_RISK_CONSTANTS.WARNING_LESSONS_THRESHOLD) {
        warningLevel = 'warning';
        warningCount++;
      } else {
        normalCount++;
      }
      const visualBadge = this.resolveVisualBadge(warningLevel);

      const lastDate = studentLastAttMap.get(stu.id);
      const inactiveDays = lastDate
        ? Math.floor((Date.now() - lastDate.getTime()) / 86400000)
        : Math.floor((Date.now() - stu.createdAt.getTime()) / 86400000);
      const isDormant = inactiveDays >= RENEWAL_RISK_CONSTANTS.DORMANT_INACTIVITY_DAYS;
      if (isDormant) dormantCount++;

      const estimatedDepletionDays = Math.round(remaining / (1.0 / 7)); // 按基线 1.0 讲/周估算

      roster.push({
        studentId: stu.id,
        studentNo: stu.studentNo,
        name: stu.name,
        phone: stu.phone || '',
        packageId: pkg.id,
        courseName: pkg.course?.name || cls.course?.name,
        remainingLessons: remaining,
        consumedLessons: pkg.consumedLessons,
        warningLevel,
        visualBadge,
        weeklyBurnRate: 1.0,
        estimatedDepletionDays,
        inactiveDays,
        isDormant,
        canQuickRenew: remaining <= RENEWAL_RISK_CONSTANTS.WARNING_LESSONS_THRESHOLD,
      });
    }

    // 综合加权班级健康指数 [0-100]
    const totalStudents = roster.length || 1;
    const criticalPenalty = (criticalCount / totalStudents) * 50;
    const warningPenalty = (warningCount / totalStudents) * 25;
    const dormantPenalty = (dormantCount / totalStudents) * 25;
    const classHealthIndex = Math.max(
      0,
      Math.round(100 - criticalPenalty - warningPenalty - dormantPenalty),
    );

    return {
      classId: cls.id,
      className: cls.name,
      courseId: cls.courseId,
      courseName: cls.course?.name || '未知课程',
      teacherName: cls.teacher?.realName || '主讲老师',
      capacity: cls.capacity,
      currentStudentCount: cls.currentStudentCount,
      classHealthIndex,
      statistics: {
        criticalCount,
        warningCount,
        normalCount,
        dormantCount,
      },
      roster,
    };
  }

  /**
   * 4. 一键生成续费开单智能预填草案 (Create Renewal Order Draft - Zero Glue to Enroll)
   * 闭环业务不变量：
   * - ACB 财务防腐屏障：严禁针对已退费课包或在途退费课包生成续费草案
   * - 继承原课包课程与协议单价
   * - 原班容量 CAS 准入预检 (满员自动安全退化为待分班池)
   * - 电子钱包本金抵扣试算
   * - 直接装配可落盘的 EnrollStudentCommand
   */
  async createRenewalOrderDraft(
    studentId: string,
    options?: RenewalDraftOptions,
  ): Promise<RenewalOrderDraft> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        campus: true,
        wallet: true,
        packages: {
          include: { course: true, class: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员档案 (ID: ${studentId})`);
    }

    // 1. 财务防腐屏障 (Anti-Corruption Barrier, ACB)
    const hasRefundedPkg = student.packages.some((p) => p.status === 'refunded');
    const pendingRefundOrder = await this.prisma.order.findFirst({
      where: {
        studentId: student.id,
        orderType: 'refund',
        status: 'unpaid',
      },
    });

    if (hasRefundedPkg || pendingRefundOrder) {
      throw new RefundLockedException(
        pendingRefundOrder?.id || student.packages.find((p) => p.status === 'refunded')?.id || '',
        '该学员存在已退费或在途退费审批课包，已被财务防腐屏障锁定，严禁生成续费开单草案',
      );
    }

    // 2. 定位需续报课包与目标课程
    const targetPackageId = options?.preferredPackageId || options?.packageId;
    const targetPkg = targetPackageId
      ? student.packages.find((p) => p.id === targetPackageId)
      : student.packages
          .filter((p) => p.status === 'active')
          .sort((a, b) => a.remainingLessons - b.remainingLessons)[0];

    const courseId = options?.targetCourseId || targetPkg?.courseId;
    if (!courseId) {
      throw new BadRequestException('该学员未持有任何可用在读课包，请走全新招生开单流程');
    }

    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException(`目标课程不存在 (ID: ${courseId})`);
    }

    // 3. 原班级满员 CAS 预检
    let targetClass = targetPkg?.class || null;
    let isClassFull = false;
    let warningMessage: string | undefined = undefined;

    if (options?.targetClassId) {
      targetClass = await this.prisma.class.findUnique({
        where: { id: options.targetClassId },
      });
    }

    if (targetClass) {
      const freshClass = await this.prisma.class.findUnique({
        where: { id: targetClass.id },
      });
      if (freshClass && freshClass.currentStudentCount >= freshClass.capacity) {
        isClassFull = true;
        warningMessage = `原在读班级 [${freshClass.name}] 当前在读已达上限 (${freshClass.capacity}人)，续费草案已自动置为待分班状态以防超编`;
        targetClass = null; // 安全降级为待分班池
      }
    }

    // 4. 课时阶梯与价格推导
    const totalLessons =
      options?.recommendedLessons ||
      options?.customLessons ||
      RENEWAL_RISK_CONSTANTS.RECOMMENDED_SEMESTER_LESSONS;
    const bonusLessons = 2; // 老学员续报默认配赠 2 课时
    const pricePerLesson = targetPkg?.pricePerLesson || course.pricePerLesson || 200;
    const originalTotalPrice = pricePerLesson * totalLessons;
    const suggestedDiscount = options?.customDiscount !== undefined ? options.customDiscount : 200;
    const actualPayAmount = Math.max(0, originalTotalPrice - suggestedDiscount);

    // 5. 电子钱包可用本金智能匹配
    const principalBalance = student.wallet?.principalBalance || 0;
    const canUseWalletDeduction = principalBalance >= actualPayAmount;
    const paymentMethod = options?.paymentMethod || (canUseWalletDeduction ? 'wallet' : 'wechat');

    const draftId = `DRAFT-${Date.now().toString().slice(-6)}`;

    // 6. 装配零胶水 EnrollStudentCommand
    const enrollCommand: RenewalOrderDraft['enrollCommand'] = {
      studentId: student.id,
      courseId: course.id,
      classId: targetClass ? targetClass.id : undefined,
      totalLessons,
      bonusLessons,
      pricePerLesson,
      discountAmount: suggestedDiscount,
      couponAmount: 0,
      paymentMethod,
      channel: 'renewal',
      ownerId: options?.operatorId || options?.operator?.operatorId,
      remark: `老学员续费开单 (智能草案 ${draftId})，原单价 ¥${pricePerLesson}/课时`,
    };

    return {
      draftId,
      studentId: student.id,
      studentName: student.name,
      studentNo: student.studentNo,
      campusId: student.campusId,
      campusName: student.campus?.name || '总部校区',
      createdAt: new Date().toISOString(),
      quote: {
        courseId: course.id,
        courseName: course.name,
        classId: targetClass ? targetClass.id : null,
        className: targetClass ? targetClass.name : null,
        totalLessons,
        bonusLessons,
        pricePerLesson,
        originalTotalPrice,
        suggestedDiscount,
        walletPrincipalBalance: principalBalance,
        canUseWalletDeduction,
        actualPayAmount,
        paymentMethod,
        remark: enrollCommand.remark || '',
      },
      validation: {
        pass: true,
        isClassFull,
        isRefundLocked: false,
        warningMessage,
      },
      enrollCommand,
    };
  }
}
