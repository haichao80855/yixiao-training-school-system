/**
 * 生产级 HTTP 网络适配器 (Http Renewal Decision Adapter)
 * 对齐后端 ADR-0006 课消风控与续费决策协议
 */

import { request } from '../../../utils/request';
import { classApi } from '../../../api/class';
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

export class HttpRenewalDecisionAdapter implements RenewalDecisionPort {
  /**
   * 拉取校区学员课消预警大盘统计与流失名册
   */
  async fetchWarningRoster(filter?: RenewalDashboardFilter): Promise<RenewalDashboardView> {
    const res = await request<any>({
      url: '/api/students/renewal/roster',
      method: 'GET',
      data: filter,
    });

    const rawStats = res?.statistics || {};
    const rawList: any[] = Array.isArray(res?.list) ? res.list : [];

    const criticalCount = Number(rawStats.criticalCount ?? 0);
    const warningCount = Number(rawStats.warningCount ?? 0);
    const normalCount = Number(rawStats.normalCount ?? 0);
    const dormantCount = Number(rawStats.dormantCount ?? 0);
    const windowOpenCount = Number(rawStats.windowOpenCount ?? 0);

    // 预估续费总池 (元): 若服务端未下发，端侧按处于窗口学员的 (标准单价 * 48 - 200) 动态汇聚
    let estimatedRenewalPoolAmount = Number(rawStats.estimatedRenewalPoolAmount ?? 0);
    if (!estimatedRenewalPoolAmount && rawList.length > 0) {
      estimatedRenewalPoolAmount = rawList
        .filter((item) => item.decision?.renewalWindowOpen || item.consumptionHealth?.warningLevel !== 'normal')
        .reduce((sum, item) => {
          const price = item.quote?.pricePerLesson || 200;
          return sum + Math.max(0, price * 48 - 200);
        }, 0);
    }

    const list: RenewalStudentItem[] = rawList.map((item, idx) => {
      const isUrgent =
        item.consumptionHealth?.warningLevel === 'critical' ||
        item.decision?.advice === 'URGENT_RENEWAL';
      const isDormant =
        item.consumptionHealth?.dormantRisk === 'dormant_warning' ||
        item.consumptionHealth?.dormantRisk === 'dormant_severe';
      const isPendingClass = !item.classId && (!item.classes || item.classes.length === 0);
      const isRefundLocked = !!item.decision?.isRefundLocked;

      let type = 'lessons_low';
      if (isRefundLocked) {
        type = 'refund_locked';
      } else if (isDormant) {
        type = 'dormant';
      } else if (isPendingClass) {
        type = 'pending_class';
      }

      let reason = item.consumptionHealth?.warningLevel === 'critical'
        ? `剩余课次仅剩 ${item.assetSummary?.totalRemainingLessons ?? 0} 节，消课风险极高`
        : `预计还有 ${item.consumptionHealth?.estimatedDepletionDays ?? 30} 天课时耗尽，建议及时跟进续费`;

      if (isRefundLocked) {
        reason = item.decision?.blockingReason || '学员存在在途审批或已退费课包，已被财务防腐屏障锁定';
      } else if (isDormant) {
        reason = `连续 ${item.consumptionHealth?.inactiveDays ?? 14} 天无出勤消课，存在休眠流失风险`;
      }

      return {
        id: item.studentId || item.id || `w-stu-${idx}`,
        studentId: item.studentId || item.id,
        studentNo: item.studentNo || '',
        studentName: item.studentName || item.name || '学员',
        phone: item.phone || '',
        campusId: item.campusId || '',
        campusName: item.campusName || '拓视未来-原阳校区',
        currentStatus: item.currentStatus || '在读',
        grade: item.grade || '在读',
        courseId: item.decision?.targetCourseId || item.courseId,
        courseName: item.decision?.targetCourseName || item.courseName || '常规课程',
        classId: item.classId || item.targetClassId || item.packages?.[0]?.classId,
        className: item.className || item.targetClassName || item.packages?.[0]?.class?.name,
        pricePerLesson: Number(item.pricePerLesson ?? item.quote?.pricePerLesson ?? item.packages?.[0]?.pricePerLesson ?? 200),
        level: isUrgent ? 'urgent' : 'warning',
        reason,
        updatedAt: item.consumptionHealth?.lastAttendanceDate || '今日',
        type,
        assetSummary: {
          totalRemainingLessons: Number(item.assetSummary?.totalRemainingLessons ?? 0),
          totalConsumedLessons: Number(item.assetSummary?.totalConsumedLessons ?? 0),
          activePackageCount: Number(item.assetSummary?.activePackageCount ?? 1),
          principalBalance: Number(item.assetSummary?.principalBalance ?? 0),
          bonusBalance: Number(item.assetSummary?.bonusBalance ?? 0),
        },
        consumptionHealth: {
          weeklyBurnRate: Number(item.consumptionHealth?.weeklyBurnRate ?? 1.0),
          dailyBurnRate: Number(item.consumptionHealth?.dailyBurnRate ?? 0.14),
          estimatedDepletionDays: Number(item.consumptionHealth?.estimatedDepletionDays ?? 30),
          estimatedDepletionDate: item.consumptionHealth?.estimatedDepletionDate || '待定',
          warningLevel: item.consumptionHealth?.warningLevel || (isUrgent ? 'critical' : 'warning'),
          visualBadge: item.consumptionHealth?.visualBadge || {
            level: isUrgent ? 'critical' : 'warning',
            color: isUrgent ? 'danger' : 'warning',
            type: isUrgent ? 'danger' : 'warning',
            label: isUrgent ? '紧急枯竭 (<=4课时)' : '预警关注 (<=8课时)',
            text: isUrgent ? '紧急枯竭 (<=4课时)' : '预警关注 (<=8课时)',
            cssClass: isUrgent
              ? 'text-rose-600 font-bold bg-rose-50 border border-rose-200'
              : 'text-amber-600 font-semibold bg-amber-50 border border-amber-200',
          },
          lastAttendanceDate: item.consumptionHealth?.lastAttendanceDate || null,
          inactiveDays: Number(item.consumptionHealth?.inactiveDays ?? 0),
          dormantRisk: item.consumptionHealth?.dormantRisk || 'active',
          futureScheduledLessons: Number(item.consumptionHealth?.futureScheduledLessons ?? 0),
        },
        decision: {
          renewalWindowOpen: item.decision?.renewalWindowOpen ?? true,
          advice: item.decision?.advice || (isUrgent ? 'URGENT_RENEWAL' : 'WINDOW_OPEN'),
          targetPackageId: item.decision?.targetPackageId || null,
          targetCourseId: item.decision?.targetCourseId || null,
          targetCourseName: item.decision?.targetCourseName || null,
          isRefundLocked,
          blockingReason: item.decision?.blockingReason,
        },
      };
    });

    const unassignedCount = rawList.filter((item) => !item.classId && (!item.classes || item.classes.length === 0)).length;
    const pendingCount = Number(rawStats.pendingCount !== undefined ? rawStats.pendingCount : unassignedCount);

    return {
      total: Number(res?.total ?? list.length),
      page: Number(res?.page ?? 1),
      pageSize: Number(res?.pageSize ?? 20),
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
      list,
    };
  }

  /**
   * 单学员课消全景诊断
   */
  async fetchStudentRisk(studentId: string): Promise<any> {
    return request<any>({
      url: `/api/students/${studentId}/renewal-risk`,
      method: 'GET',
    });
  }

  /**
   * 服务端生成续费开单草案
   */
  async generateRenewalDraft(studentId: string, options?: RenewalDraftOptions): Promise<RenewalOrderDraft> {
    try {
      const draft = await request<RenewalOrderDraft>({
        url: `/api/students/${studentId}/renewal-draft`,
        method: 'POST',
        data: options,
      });

      if (!draft || !draft.draftId) {
        throw new Error('服务端未返回有效的续费草案数据');
      }

      // 若原在读班级满员，确保 fallbackUnassigned 置位
      if (draft.validation && draft.validation.isClassFull) {
        draft.validation.fallbackUnassigned = true;
        if (draft.enrollCommand) {
          draft.enrollCommand.fallbackUnassigned = true;
          draft.enrollCommand.classId = undefined;
        }
      }

      return draft;
    } catch (err: any) {
      const errMsg = err?.message || err?.data?.message || String(err);
      if (
        errMsg.includes('退费') ||
        errMsg.includes('RefundLocked') ||
        errMsg.includes('防腐屏障') ||
        err?.code === 'REFUND_LOCKED' ||
        err?.status === 409 ||
        err?.statusCode === 409 ||
        (err?.status === 400 && errMsg.includes('锁定'))
      ) {
        throw new RefundLockedError(
          errMsg || '该学员名下存在已退费或在途退费审批课包，已被财务防腐屏障锁定，严禁生成续费开单草案',
          err?.recordId
        );
      }
      throw err;
    }
  }

  /**
   * 班级容量即时核验
   */
  async checkClassCapacity(classId: string) {
    const detail = await classApi.getClassDetail(classId);
    const capacity = detail?.capacity ?? 10;
    const currentStudentCount = detail?.currentStudentCount ?? 0;
    return {
      capacity,
      currentStudentCount,
      isFull: currentStudentCount >= capacity,
    };
  }
}
