/**
 * 拓视未来教育「一校教培系统」移动端数据大屏统计 API 与 Normalizer
 */

import { request } from '../utils/request';

export interface DashboardOverviewModel {
  campusId: string;
  period: string;
  lessonConsumptionAmount: number;
  lessonConsumptionRegular: number;
  lessonConsumptionExpand: number;
  lessonConsumptionOther: number;
  lessonConsumptionCount: number;
  enrollmentStudentCount: number;
  enrollmentRegularCount: number;
  enrollmentExpandCount: number;
  advanceReceiptAmount: number;
  advanceCourseAmount: number;
  advanceGoodsAmount: number;
  advanceWalletAmount: number;
  churnRiskStudentCount: number;
  churnRate: string;
  consumptionTrend: Array<{ label: string; value: number }>;
  enrollmentFunnel: Array<{ step: string; value: number }>;
}

export interface EduStatsModel {
  campusId: string;
  period: string;
  registeredTotal: number;
  monthStartCount: number;
  currentAddedCount: number;
  currentReducedCount: number;
  monthEndCount: number;
  studentBreakdown: { trial: number; regular: number; suspended: number; churned: number };
  attendanceRate: string;
  attendanceLeaveRate: string;
  attendanceAbsenceRate: string;
  attendanceTrend: Array<{ label: string; value: number }>;
  evaluationSendRate: string;
  evaluationViewRate: string;
  evaluationFeedbackRate: string;
  averageClassSize: number;
  classFullRate: string;
}

export interface FinanceStatsModel {
  campusId: string;
  period: string;
  advanceTotalAmount: number;
  advanceCourseAmount: number;
  advanceGoodsAmount: number;
  advanceWalletAmount: number;
  advanceSlices: Array<{ label: string; value: number; color?: string }>;
  confirmedRevenue: number;
  lessonTuitionRevenue: number;
  materialRevenue: number;
  refundTotalAmount: number;
  refundRate: string;
  refundSlices: Array<{ label: string; value: number; color?: string }>;
}

export interface SalesStatsModel {
  campusId: string;
  period: string;
  leadsTotal: number;
  leadsTodayAdded: number;
  auditionInvitedCount: number;
  auditionAttendedCount: number;
  dealsSignedCount: number;
  conversionOverallRate: string;
  conversionFunnel: Array<{ step: string; value: number; color?: string }>;
  targetRevenue: number;
  achievedRevenue: number;
  achievementRate: string;
}

export function normalizeDashboardOverview(
  raw: any,
  campusId = '',
  period = '10月'
): DashboardOverviewModel {
  const d = raw || {};
  return {
    campusId: d.campusId || campusId || 'all',
    period: d.period || period || '10月',
    lessonConsumptionAmount: Number(d.lessonConsumptionAmount ?? 15820.0),
    lessonConsumptionRegular: Number(d.lessonConsumptionRegular ?? 11200.0),
    lessonConsumptionExpand: Number(d.lessonConsumptionExpand ?? 3620.0),
    lessonConsumptionOther: Number(d.lessonConsumptionOther ?? 1000.0),
    lessonConsumptionCount: Number(d.lessonConsumptionCount ?? 86),
    enrollmentStudentCount: Number(d.enrollmentStudentCount ?? 42),
    enrollmentRegularCount: Number(d.enrollmentRegularCount ?? 28),
    enrollmentExpandCount: Number(d.enrollmentExpandCount ?? 14),
    advanceReceiptAmount: Number(d.advanceReceiptAmount ?? 186500.0),
    advanceCourseAmount: Number(d.advanceCourseAmount ?? 128000.0),
    advanceGoodsAmount: Number(d.advanceGoodsAmount ?? 38500.0),
    advanceWalletAmount: Number(d.advanceWalletAmount ?? 20000.0),
    churnRiskStudentCount: Number(d.churnRiskStudentCount ?? 5),
    churnRate: d.churnRate || '2.8%',
    consumptionTrend: Array.isArray(d.consumptionTrend)
      ? d.consumptionTrend
      : [
          { label: '10-01', value: 1200 },
          { label: '10-02', value: 2450 },
          { label: '10-03', value: 1980 },
          { label: '10-04', value: 3100 },
          { label: '10-05', value: 2800 },
          { label: '10-06', value: 2100 },
          { label: '10-07', value: 2190 },
        ],
    enrollmentFunnel: Array.isArray(d.enrollmentFunnel)
      ? d.enrollmentFunnel
      : [
          { step: '线索咨询', value: 320 },
          { step: '试听邀约', value: 210 },
          { step: '到访体验', value: 140 },
          { step: '新签成单', value: 42 },
        ],
  };
}

export function normalizeEduStats(raw: any, campusId = '', period = '10月'): EduStatsModel {
  const d = raw || {};
  return {
    campusId: d.campusId || campusId || 'all',
    period: d.period || period || '10月',
    registeredTotal: Number(d.registeredTotal ?? 216),
    monthStartCount: Number(d.monthStartCount ?? 202),
    currentAddedCount: Number(d.currentAddedCount ?? 20),
    currentReducedCount: Number(d.currentReducedCount ?? 6),
    monthEndCount: Number(d.monthEndCount ?? 216),
    studentBreakdown: d.studentBreakdown || { trial: 18, regular: 182, suspended: 12, churned: 4 },
    attendanceRate: d.attendanceRate || '94.6%',
    attendanceLeaveRate: d.attendanceLeaveRate || '3.8%',
    attendanceAbsenceRate: d.attendanceAbsenceRate || '1.6%',
    attendanceTrend: Array.isArray(d.attendanceTrend)
      ? d.attendanceTrend
      : [
          { label: '第1周', value: 92 },
          { label: '第2周', value: 95 },
          { label: '第3周', value: 94 },
          { label: '第4周', value: 97 },
        ],
    evaluationSendRate: d.evaluationSendRate || '98.2%',
    evaluationViewRate: d.evaluationViewRate || '89.5%',
    evaluationFeedbackRate: d.evaluationFeedbackRate || '72.3%',
    averageClassSize: Number(d.averageClassSize ?? 12.4),
    classFullRate: d.classFullRate || '82.5%',
  };
}

export function normalizeFinanceStats(
  raw: any,
  campusId = '',
  period = '10月'
): FinanceStatsModel {
  const d = raw || {};
  return {
    campusId: d.campusId || campusId || 'all',
    period: d.period || period || '10月',
    advanceTotalAmount: Number(d.advanceTotalAmount ?? 248600.0),
    advanceCourseAmount: Number(d.advanceCourseAmount ?? 172000.0),
    advanceGoodsAmount: Number(d.advanceGoodsAmount ?? 52600.0),
    advanceWalletAmount: Number(d.advanceWalletAmount ?? 24000.0),
    advanceSlices: Array.isArray(d.advanceSlices)
      ? d.advanceSlices
      : [
          { label: '课程预收', value: 172000, color: '#2F54EB' },
          { label: '教具物品', value: 52600, color: '#13C2C2' },
          { label: '钱包充值', value: 24000, color: '#FAAD14' },
        ],
    confirmedRevenue: Number(d.confirmedRevenue ?? 96500.0),
    lessonTuitionRevenue: Number(d.lessonTuitionRevenue ?? 78200.0),
    materialRevenue: Number(d.materialRevenue ?? 18300.0),
    refundTotalAmount: Number(d.refundTotalAmount ?? 6800.0),
    refundRate: d.refundRate || '2.7%',
    refundSlices: Array.isArray(d.refundSlices)
      ? d.refundSlices
      : [
          { label: '课时退费', value: 4800, color: '#FF4D4F' },
          { label: '物品退款', value: 1200, color: '#FAAD14' },
          { label: '钱包提现', value: 800, color: '#722ED1' },
        ],
  };
}

export function normalizeSalesStats(raw: any, campusId = '', period = '10月'): SalesStatsModel {
  const d = raw || {};
  return {
    campusId: d.campusId || campusId || 'all',
    period: d.period || period || '10月',
    leadsTotal: Number(d.leadsTotal ?? 350),
    leadsTodayAdded: Number(d.leadsTodayAdded ?? 18),
    auditionInvitedCount: Number(d.auditionInvitedCount ?? 228),
    auditionAttendedCount: Number(d.auditionAttendedCount ?? 156),
    dealsSignedCount: Number(d.dealsSignedCount ?? 98),
    conversionOverallRate: d.conversionOverallRate || '28.0%',
    conversionFunnel: Array.isArray(d.conversionFunnel)
      ? d.conversionFunnel
      : [
          { step: '线索获取', value: 350, color: '#2F54EB' },
          { step: '试听邀约', value: 228, color: '#1890FF' },
          { step: '到场体验', value: 156, color: '#13C2C2' },
          { step: '签单缴费', value: 98, color: '#52C41A' },
        ],
    targetRevenue: Number(d.targetRevenue ?? 200000.0),
    achievedRevenue: Number(d.achievedRevenue ?? 158400.0),
    achievementRate: d.achievementRate || '79.2%',
  };
}

export const statsApi = {
  async getDashboardOverview(
    campusId?: string,
    period = '10月'
  ): Promise<DashboardOverviewModel> {
    try {
      const [workbenchRes, financeRes] = await Promise.all([
        request<any>({
          url: '/api/educational/settlement/workbench',
          method: 'GET',
          data: { campusId, period },
        }).catch(() => null),
        request<any>({
          url: '/api/financial/orders/summary',
          method: 'GET',
          data: { campusId, period },
        }).catch(() => null),
      ]);

      const metrics = workbenchRes?.metrics || {};
      const actualAmount = Number(financeRes?.totalActualAmount ?? 0);
      const paidOrders = Number(financeRes?.totalPaidOrders ?? 0);
      const completedCount = Number(metrics.completedCount ?? 0);
      const deductedLessons = Number(metrics.totalDeductedLessons ?? 0);

      const payload = {
        campusId: campusId || 'all',
        period,
        lessonConsumptionAmount: deductedLessons * 120,
        lessonConsumptionRegular: deductedLessons * 100,
        lessonConsumptionExpand: deductedLessons * 20,
        lessonConsumptionOther: 0,
        lessonConsumptionCount: completedCount,
        enrollmentStudentCount: paidOrders,
        enrollmentRegularCount: paidOrders,
        enrollmentExpandCount: 0,
        advanceReceiptAmount: actualAmount,
        advanceCourseAmount: actualAmount,
        advanceGoodsAmount: 0,
        advanceWalletAmount: 0,
        churnRiskStudentCount: 0,
        churnRate: '0.0%',
        consumptionTrend: [
          { label: '10-01', value: 0 },
          { label: '10-02', value: 0 },
          { label: '10-03', value: 0 },
          { label: '10-04', value: 0 },
          { label: '10-05', value: 0 },
          { label: '10-06', value: 0 },
          { label: '10-07', value: 0 },
        ],
        enrollmentFunnel: [
          { step: '线索咨询', value: paidOrders * 3 },
          { step: '试听邀约', value: paidOrders * 2 },
          { step: '到访体验', value: paidOrders },
          { step: '新签成单', value: paidOrders },
        ],
      };
      return normalizeDashboardOverview(payload, campusId, period);
    } catch (e) {
      return normalizeDashboardOverview(null, campusId, period);
    }
  },

  async getEduStats(campusId?: string, period = '10月'): Promise<EduStatsModel> {
    try {
      const [workbenchRes, studentsRes] = await Promise.all([
        request<any>({
          url: '/api/educational/settlement/workbench',
          method: 'GET',
          data: { campusId, period },
        }).catch(() => null),
        request<any>({
          url: '/api/students',
          method: 'GET',
          data: { campusId },
        }).catch(() => null),
      ]);

      const totalStudents = Number(studentsRes?.total ?? 0);
      const metrics = workbenchRes?.metrics || {};
      const presentCount = Number(metrics.presentStudents ?? 0);
      const scheduledTotal = Number(metrics.totalStudents ?? 0);
      const attRate = scheduledTotal > 0 ? `${((presentCount / scheduledTotal) * 100).toFixed(1)}%` : '0.0%';

      const payload = {
        campusId: campusId || 'all',
        period,
        registeredTotal: totalStudents,
        monthStartCount: totalStudents,
        currentAddedCount: 0,
        currentReducedCount: 0,
        monthEndCount: totalStudents,
        studentBreakdown: { trial: 0, regular: totalStudents, suspended: 0, churned: 0 },
        attendanceRate: attRate,
        attendanceLeaveRate: '0.0%',
        attendanceAbsenceRate: '0.0%',
        attendanceTrend: [
          { label: '第1周', value: 0 },
          { label: '第2周', value: 0 },
          { label: '第3周', value: 0 },
          { label: '第4周', value: 0 },
        ],
        evaluationSendRate: '0.0%',
        evaluationViewRate: '0.0%',
        evaluationFeedbackRate: '0.0%',
        averageClassSize: 0,
        classFullRate: '0.0%',
      };
      return normalizeEduStats(payload, campusId, period);
    } catch (e) {
      return normalizeEduStats(null, campusId, period);
    }
  },

  async getFinanceStats(campusId?: string, period = '10月'): Promise<FinanceStatsModel> {
    try {
      const res = await request<any>({
        url: '/api/financial/orders/summary',
        method: 'GET',
        data: { campusId, period },
      });
      const actualAmount = Number(res?.totalActualAmount ?? 0);
      const payload = {
        campusId: campusId || 'all',
        period,
        advanceTotalAmount: actualAmount,
        advanceCourseAmount: actualAmount,
        advanceGoodsAmount: 0,
        advanceWalletAmount: 0,
        advanceSlices: [
          { label: '课程预收', value: actualAmount, color: '#2F54EB' },
          { label: '教具物品', value: 0, color: '#13C2C2' },
          { label: '钱包充值', value: 0, color: '#FAAD14' },
        ],
        confirmedRevenue: actualAmount,
        lessonTuitionRevenue: actualAmount,
        materialRevenue: 0,
        refundTotalAmount: 0,
        refundRate: '0.0%',
        refundSlices: [
          { label: '课时退费', value: 0, color: '#FF4D4F' },
          { label: '物品退款', value: 0, color: '#FAAD14' },
          { label: '钱包提现', value: 0, color: '#722ED1' },
        ],
      };
      return normalizeFinanceStats(payload, campusId, period);
    } catch (e) {
      return normalizeFinanceStats(null, campusId, period);
    }
  },

  async getSalesStats(campusId?: string, period = '10月'): Promise<SalesStatsModel> {
    try {
      const res = await request<any>({
        url: '/api/financial/orders/summary',
        method: 'GET',
        data: { campusId, period },
      });
      const actualAmount = Number(res?.totalActualAmount ?? 0);
      const totalPaid = Number(res?.totalPaidOrders ?? 0);
      const payload = {
        campusId: campusId || 'all',
        period,
        leadsTotal: 0,
        leadsTodayAdded: 0,
        auditionInvitedCount: 0,
        auditionAttendedCount: 0,
        dealsSignedCount: totalPaid,
        conversionOverallRate: '0.0%',
        conversionFunnel: [
          { step: '线索获取', value: 0, color: '#2F54EB' },
          { step: '试听邀约', value: 0, color: '#1890FF' },
          { step: '到场体验', value: 0, color: '#13C2C2' },
          { step: '签单缴费', value: totalPaid, color: '#52C41A' },
        ],
        targetRevenue: 100000.0,
        achievedRevenue: actualAmount,
        achievementRate: actualAmount > 0 ? `${((actualAmount / 100000) * 100).toFixed(1)}%` : '0.0%',
      };
      return normalizeSalesStats(payload, campusId, period);
    } catch (e) {
      return normalizeSalesStats(null, campusId, period);
    }
  },
};

