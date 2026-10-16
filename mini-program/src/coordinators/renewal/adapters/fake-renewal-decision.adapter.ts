/**
 * 内存单测适配器 (Fake Renewal Decision Adapter)
 * 供单元测试与离线演示使用，提供完整可控的状态插桩能力
 */

import type { RenewalDecisionPort } from '../ports';
import {
  RefundLockedError,
  RENEWAL_RISK_CONSTANTS,
  type RenewalDashboardFilter,
  type RenewalDashboardView,
  type RenewalDraftOptions,
  type RenewalOrderDraft,
  type RenewalStudentItem,
} from '../types';

export class FakeRenewalDecisionAdapter implements RenewalDecisionPort {
  private students = new Map<string, any>();
  private classes = new Map<string, { id: string; name: string; capacity: number; currentStudentCount: number }>();
  private refundLockedStudents = new Set<string>();

  constructor() {
    this.seedDefaults();
  }

  public seedDefaults() {
    this.students.clear();
    this.classes.clear();
    this.refundLockedStudents.clear();

    // 预置常规班级 (未满员: 8/10)
    this.classes.set('class-math-01', {
      id: 'class-math-01',
      name: '初二数学精英春季班',
      capacity: 10,
      currentStudentCount: 8,
    });

    // 预置满员班级 (已满员: 12/12)
    this.classes.set('class-physics-full', {
      id: 'class-physics-full',
      name: '初三物理冲刺满员班',
      capacity: 12,
      currentStudentCount: 12,
    });

    // 预置常规学员 1: 课时枯竭紧急学员 (剩余 2 课时，签约价 220)
    this.students.set('stu-urgent-01', {
      id: 'stu-urgent-01',
      studentNo: 'STU-2026-001',
      name: '陈小明',
      phone: '13800138001',
      campusId: 'campus-bj-01',
      campusName: '中关村校区',
      status: '在读',
      grade: '初二',
      courseId: 'crs-math-02',
      courseName: '初中数学培优',
      classId: 'class-math-01',
      className: '初二数学精英春季班',
      remainingLessons: 2,
      consumedLessons: 46,
      pricePerLesson: 220,
      principalBalance: 5000,
      bonusBalance: 200,
      inactiveDays: 3,
      weeklyBurnRate: 2.0,
      estimatedDepletionDays: 7,
      lastAttendanceDate: '2026-10-14',
    });

    // 预置学员 2: 原班已满员学员 (用于验证班容溢出自动降级为待分班)
    this.students.set('stu-fullclass-02', {
      id: 'stu-fullclass-02',
      studentNo: 'STU-2026-002',
      name: '林月茹',
      phone: '13800138002',
      campusId: 'campus-bj-01',
      campusName: '中关村校区',
      status: '在读',
      grade: '初三',
      courseId: 'crs-phy-03',
      courseName: '初三物理拔高',
      classId: 'class-physics-full',
      className: '初三物理冲刺满员班',
      remainingLessons: 3,
      consumedLessons: 33,
      pricePerLesson: 260,
      principalBalance: 0,
      bonusBalance: 0,
      inactiveDays: 2,
      weeklyBurnRate: 1.5,
      estimatedDepletionDays: 14,
      lastAttendanceDate: '2026-10-15',
    });

    // 预置学员 3: 存在在途退费/已退费学员 (用于验证 ACB 财务防腐强拦截)
    this.students.set('stu-refund-locked-03', {
      id: 'stu-refund-locked-03',
      studentNo: 'STU-2026-003',
      name: '赵灵儿',
      phone: '13800138003',
      campusId: 'campus-bj-01',
      campusName: '中关村校区',
      status: '在读',
      grade: '小六',
      courseId: 'crs-eng-01',
      courseName: '少儿英语口语',
      classId: 'class-eng-01',
      className: '少儿英语入门A班',
      remainingLessons: 1,
      consumedLessons: 20,
      pricePerLesson: 180,
      principalBalance: 0,
      bonusBalance: 0,
      inactiveDays: 8,
      weeklyBurnRate: 1.0,
      estimatedDepletionDays: 7,
      lastAttendanceDate: '2026-10-08',
      isRefundLocked: true,
    });
    this.refundLockedStudents.add('stu-refund-locked-03');

    // 预置学员 4: 休眠流失高危学员 (连续 21 天未消课)
    this.students.set('stu-dormant-04', {
      id: 'stu-dormant-04',
      studentNo: 'STU-2026-004',
      name: '李逍遥',
      phone: '13800138004',
      campusId: 'campus-bj-01',
      campusName: '中关村校区',
      status: '在读',
      grade: '高一',
      courseId: 'crs-phy-high',
      courseName: '高中物理强化',
      classId: null,
      className: null,
      remainingLessons: 12,
      consumedLessons: 8,
      pricePerLesson: 240,
      principalBalance: 200,
      bonusBalance: 0,
      inactiveDays: 21,
      weeklyBurnRate: 0.0,
      estimatedDepletionDays: 999,
      lastAttendanceDate: '2026-09-25',
    });
  }

  // --- 测试插桩 API ---
  public setRefundLocked(studentId: string, locked: boolean) {
    if (locked) {
      this.refundLockedStudents.add(studentId);
      const stu = this.students.get(studentId);
      if (stu) stu.isRefundLocked = true;
    } else {
      this.refundLockedStudents.delete(studentId);
      const stu = this.students.get(studentId);
      if (stu) stu.isRefundLocked = false;
    }
  }

  public setClassCapacity(classId: string, capacity: number, currentStudentCount: number) {
    const cls = this.classes.get(classId) || { id: classId, name: '测试班级', capacity, currentStudentCount };
    cls.capacity = capacity;
    cls.currentStudentCount = currentStudentCount;
    this.classes.set(classId, cls);
  }

  public addStudent(student: any) {
    this.students.set(student.id, student);
    if (student.isRefundLocked) {
      this.refundLockedStudents.add(student.id);
    }
  }

  // --- 端口实现 ---

  async fetchWarningRoster(filter?: RenewalDashboardFilter): Promise<RenewalDashboardView> {
    const list: RenewalStudentItem[] = [];
    let criticalCount = 0;
    let warningCount = 0;
    let normalCount = 0;
    let dormantCount = 0;
    let pendingCount = 0;
    let windowOpenCount = 0;

    for (const stu of this.students.values()) {
      const remaining = Number(stu.remainingLessons || 0);
      const inactiveDays = Number(stu.inactiveDays || 0);

      let warningLevel: 'critical' | 'warning' | 'normal' = 'normal';
      if (remaining <= RENEWAL_RISK_CONSTANTS.CRITICAL_LESSONS_THRESHOLD) {
        warningLevel = 'critical';
        criticalCount++;
      } else if (remaining <= RENEWAL_RISK_CONSTANTS.WARNING_LESSONS_THRESHOLD) {
        warningLevel = 'warning';
        warningCount++;
      } else {
        normalCount++;
      }

      let dormantRisk: 'active' | 'dormant_warning' | 'dormant_severe' = 'active';
      if (inactiveDays >= RENEWAL_RISK_CONSTANTS.DORMANT_SEVERE_DAYS) {
        dormantRisk = 'dormant_severe';
        dormantCount++;
      } else if (inactiveDays >= RENEWAL_RISK_CONSTANTS.DORMANT_INACTIVITY_DAYS) {
        dormantRisk = 'dormant_warning';
        dormantCount++;
      }

      if (!stu.classId) {
        pendingCount++;
      }

      const renewalWindowOpen =
        remaining <= RENEWAL_RISK_CONSTANTS.WARNING_LESSONS_THRESHOLD ||
        stu.estimatedDepletionDays <= RENEWAL_RISK_CONSTANTS.RENEWAL_WINDOW_DAYS;
      if (renewalWindowOpen) {
        windowOpenCount++;
      }

      const isRefundLocked = this.refundLockedStudents.has(stu.id) || !!stu.isRefundLocked;

      let advice: any = 'HEALTHY_LEARNING';
      if (isRefundLocked) {
        advice = 'BLOCKED_REFUNDING';
      } else if (warningLevel === 'critical') {
        advice = 'URGENT_RENEWAL';
      } else if (dormantRisk !== 'active') {
        advice = 'DORMANT_FOLLOWUP';
      } else if (renewalWindowOpen) {
        advice = 'WINDOW_OPEN';
      }

      let levelText = '健康在读';
      let cssClass = 'text-emerald-600 font-medium bg-emerald-50 border border-emerald-200';
      if (warningLevel === 'critical') {
        levelText = '紧急枯竭 (<=4课时)';
        cssClass = 'text-rose-600 font-bold bg-rose-50 border border-rose-200';
      } else if (warningLevel === 'warning') {
        levelText = '预警关注 (<=8课时)';
        cssClass = 'text-amber-600 font-semibold bg-amber-50 border border-amber-200';
      }

      const item: RenewalStudentItem = {
        id: stu.id,
        studentId: stu.id,
        studentNo: stu.studentNo,
        studentName: stu.name,
        phone: stu.phone,
        campusId: stu.campusId,
        campusName: stu.campusName,
        currentStatus: stu.status,
        grade: stu.grade || '初中',
        courseId: stu.courseId,
        courseName: stu.courseName || '标准课程',
        classId: stu.classId,
        className: stu.className,
        pricePerLesson: Number(stu.pricePerLesson || 200),
        level: warningLevel === 'critical' ? 'urgent' : warningLevel === 'warning' ? 'warning' : 'normal',
        reason:
          isRefundLocked
            ? '该学员存在已退费或在途退费单据，已被财务防腐屏障锁定'
            : warningLevel === 'critical'
              ? `正课剩余仅剩 ${remaining} 节，消课风险极高，请立即跟进续费`
              : dormantRisk !== 'active'
                ? `连续 ${inactiveDays} 天无出勤消课，存在停消休眠流失风险`
                : `预计还有 ${stu.estimatedDepletionDays || 30} 天课时耗尽，建议适时推介方案`,
        updatedAt: stu.lastAttendanceDate || '今日',
        type:
          isRefundLocked
            ? 'refund_locked'
            : dormantRisk !== 'active'
              ? 'dormant'
              : !stu.classId
                ? 'pending_class'
                : 'lessons_low',
        assetSummary: {
          totalRemainingLessons: remaining,
          totalConsumedLessons: Number(stu.consumedLessons || 0),
          activePackageCount: 1,
          principalBalance: Number(stu.principalBalance || 0),
          bonusBalance: Number(stu.bonusBalance || 0),
        },
        consumptionHealth: {
          weeklyBurnRate: Number(stu.weeklyBurnRate || 1.0),
          dailyBurnRate: Number(((stu.weeklyBurnRate || 1.0) / 7).toFixed(2)),
          estimatedDepletionDays: Number(stu.estimatedDepletionDays || 30),
          estimatedDepletionDate: '2026-11-15',
          warningLevel,
          visualBadge: {
            level: warningLevel,
            color: warningLevel === 'critical' ? 'danger' : warningLevel === 'warning' ? 'warning' : 'success',
            type: warningLevel === 'critical' ? 'danger' : warningLevel === 'warning' ? 'warning' : 'success',
            label: levelText,
            text: levelText,
            cssClass,
          },
          lastAttendanceDate: stu.lastAttendanceDate || null,
          inactiveDays,
          dormantRisk,
          futureScheduledLessons: 0,
        },
        decision: {
          renewalWindowOpen,
          advice,
          targetPackageId: 'pkg-' + stu.id,
          targetCourseId: stu.courseId,
          targetCourseName: stu.courseName,
          isRefundLocked,
          blockingReason: isRefundLocked ? '该学员名下存在已退费或在途审批退费单，已被财务防腐屏障锁定' : undefined,
        },
      };

      list.push(item);
    }

    // 内存过滤
    let filtered = list;
    if (filter?.keyword) {
      const kw = filter.keyword.trim().toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.studentName.toLowerCase().includes(kw) ||
          s.phone.includes(kw) ||
          s.studentNo.toLowerCase().includes(kw)
      );
    }
    if (filter?.warningLevel && filter.warningLevel !== 'all') {
      if (filter.warningLevel === 'urgent' || filter.warningLevel === 'critical') {
        filtered = filtered.filter((s) => s.consumptionHealth.warningLevel === 'critical');
      } else if (filter.warningLevel === 'warning') {
        filtered = filtered.filter((s) => s.consumptionHealth.warningLevel === 'warning');
      } else if (filter.warningLevel === 'dormant') {
        filtered = filtered.filter((s) => s.consumptionHealth.dormantRisk !== 'active');
      } else if (filter.warningLevel === 'pending_class') {
        filtered = filtered.filter((s) => !s.classId);
      }
    }
    if (filter?.dormantOnly) {
      filtered = filtered.filter((s) => s.consumptionHealth.dormantRisk !== 'active');
    }
    if (filter?.renewalWindowOnly) {
      filtered = filtered.filter((s) => s.decision.renewalWindowOpen);
    }

    // 预估续费总池 (元): 对所有处于续费窗口的学员，按每人 48 课时 * 原单价 - 200 优惠试算
    const estimatedRenewalPoolAmount = list
      .filter((s) => s.decision.renewalWindowOpen)
      .reduce((sum, s) => {
        const rawStu = this.students.get(s.studentId);
        const price = rawStu?.pricePerLesson || 200;
        return sum + Math.max(0, price * 48 - 200);
      }, 0);

    return {
      total: filtered.length,
      page: filter?.page || 1,
      pageSize: filter?.pageSize || 20,
      statistics: {
        urgent: criticalCount,
        warning: warningCount,
        pending: pendingCount,
        criticalCount,
        warningCount,
        normalCount,
        dormantCount,
        pendingCount,
        windowOpenCount,
        estimatedRenewalPoolAmount,
      },
      list: filtered,
    };
  }

  async fetchStudentRisk(studentId: string): Promise<any> {
    const stu = this.students.get(studentId);
    if (!stu) {
      throw new Error(`未找到学员档案 (ID: ${studentId})`);
    }
    return stu;
  }

  async generateRenewalDraft(studentId: string, options?: RenewalDraftOptions): Promise<RenewalOrderDraft> {
    const stu = this.students.get(studentId);
    if (!stu) {
      throw new Error(`未找到学员档案 (ID: ${studentId})`);
    }

    // 1. ACB 财务防腐拦截
    if (this.refundLockedStudents.has(studentId) || stu.isRefundLocked) {
      throw new RefundLockedError(
        '该学员存在已退费或在途退费审批课包，已被财务防腐屏障锁定，严禁生成续费开单草案',
        'ref-lock-' + studentId
      );
    }

    // 2. 老学员单价继承与课时阶梯
    const pricePerLesson =
      options?.pricePerLesson ||
      (options?.targetCourseId && stu.courseId !== options.targetCourseId ? 280 : stu.pricePerLesson || 200);
    const totalLessons =
      options?.customLessons ||
      options?.recommendedLessons ||
      RENEWAL_RISK_CONSTANTS.RECOMMENDED_SEMESTER_LESSONS;
    const bonusLessons = options?.bonusLessons !== undefined ? options.bonusLessons : RENEWAL_RISK_CONSTANTS.DEFAULT_BONUS_LESSONS;
    const originalTotalPrice = pricePerLesson * totalLessons;
    const suggestedDiscount =
      options?.customDiscount !== undefined
        ? options.customDiscount
        : RENEWAL_RISK_CONSTANTS.DEFAULT_SUGGESTED_DISCOUNT;
    const actualPayAmount = Math.max(0, originalTotalPrice - suggestedDiscount);

    // 3. 电子钱包抵扣匹配
    const principalBalance = Number(stu.principalBalance || 0);
    const canUseWalletDeduction = principalBalance >= actualPayAmount;
    const paymentMethod = options?.paymentMethod || (canUseWalletDeduction ? 'wallet' : 'wechat');

    // 4. 班容核验与自动安全降级 (Overcapacity Downgrade)
    const courseId = options?.targetCourseId || stu.courseId || 'crs-default';
    const courseName = stu.courseName || '推荐进阶课程';

    const targetClassId = options?.targetClassId || (options?.targetCourseId && stu.courseId !== options.targetCourseId ? null : stu.classId);
    let targetClass = targetClassId ? this.classes.get(targetClassId) : null;
    let isClassFull = false;
    let fallbackUnassigned = false;
    let warningMessage: string | undefined = undefined;

    if (targetClass) {
      const clsCourseId = (targetClass as any).courseId;
      if (clsCourseId && clsCourseId !== courseId) {
        targetClass = null;
        fallbackUnassigned = true;
        warningMessage = '切换课程与原在读班级不匹配，续费草案已自动置为待分班状态';
      } else if (targetClass.currentStudentCount >= targetClass.capacity) {
        isClassFull = true;
        fallbackUnassigned = true;
        warningMessage = `原在读班级 [${targetClass.name}] 当前在读已达上限 (${targetClass.capacity}人)，续费草案已自动置为待分班状态以防超编`;
        targetClass = null; // 安全降级
      }
    } else {
      fallbackUnassigned = true;
    }

    const draftId = `DRAFT-TEST-${Date.now().toString().slice(-6)}`;

    return {
      draftId,
      studentId: stu.id,
      studentName: stu.name,
      studentNo: stu.studentNo,
      studentPhone: stu.phone,
      campusId: stu.campusId,
      campusName: stu.campusName,
      createdAt: new Date().toISOString(),
      quote: {
        courseId,
        courseName,
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
        remark: `老学员续费开单 (智能草案 ${draftId})，原单价 ¥${pricePerLesson}/课时`,
      },
      validation: {
        pass: true,
        isClassFull,
        isRefundLocked: false,
        fallbackUnassigned,
        warningMessage,
      },
      enrollCommand: {
        studentId: stu.id,
        courseId,
        classId: targetClass ? targetClass.id : undefined,
        totalLessons,
        bonusLessons,
        pricePerLesson,
        discountAmount: suggestedDiscount,
        couponAmount: 0,
        paymentMethod,
        channel: 'renewal',
        ownerId: options?.operatorId,
        remark: `老学员续费开单 (智能草案 ${draftId})，原单价 ¥${pricePerLesson}/课时`,
        fallbackUnassigned,
      },
    };
  }

  async checkClassCapacity(classId: string) {
    const cls = this.classes.get(classId);
    if (!cls) {
      return { capacity: 10, currentStudentCount: 0, isFull: false };
    }
    return {
      capacity: cls.capacity,
      currentStudentCount: cls.currentStudentCount,
      isFull: cls.currentStudentCount >= cls.capacity,
    };
  }
}
