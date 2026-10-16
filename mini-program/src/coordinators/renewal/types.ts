/**
 * 微信小程序端侧课消风控与续费决策流水线协调器类型定义
 * Client Renewal Risk & Decision Pipeline Coordinator Types
 * 对齐后端 ADR-0006 课消风控与续费决策协议
 */

// ============================================================================
// 1. 核心常量定义 (SSOT Invariants)
// ============================================================================

export const RENEWAL_RISK_CONSTANTS = {
  /** 紧急消课枯竭红线阈值 (<= 4 课时) */
  CRITICAL_LESSONS_THRESHOLD: 4,
  /** 预警关注黄线阈值 (<= 8 课时) */
  WARNING_LESSONS_THRESHOLD: 8,
  /** 停消休眠高危天数阈值 (>= 14 天未出勤消课且无近期排课) */
  DORMANT_INACTIVITY_DAYS: 14,
  /** 严重休眠流失天数阈值 (>= 30 天无有效教学交互) */
  DORMANT_SEVERE_DAYS: 30,
  /** 续费决策黄金窗口天数 (剩余耗尽预计 <= 30 天) */
  RENEWAL_WINDOW_DAYS: 30,
  /** 推荐续费标准学期课时档位 */
  RECOMMENDED_SEMESTER_LESSONS: 48,
  /** 推荐续费季度轻量课时档位 */
  RECOMMENDED_QUARTER_LESSONS: 24,
  /** 老学员续报默认配赠课时数 */
  DEFAULT_BONUS_LESSONS: 2,
  /** 默认续约特准优惠减免 (元) */
  DEFAULT_SUGGESTED_DISCOUNT: 200,
} as const;

// ============================================================================
// 2. 强类型异常定义 (ACB 防腐屏障阻断)
// ============================================================================

export class RefundLockedError extends Error {
  readonly code = 'REFUND_LOCKED';
  public readonly refundRecordId?: string;

  constructor(
    message = '该学员名下存在已退费或在途审批退费单，已被财务防腐屏障锁定，严禁发起续费开单',
    refundRecordId?: string
  ) {
    super(message);
    this.name = 'RefundLockedError';
    this.refundRecordId = refundRecordId;
    Object.setPrototypeOf(this, RefundLockedError.prototype);
  }
}

// ============================================================================
// 3. 预警评级与动作语义
// ============================================================================

export type RenewalWarningLevel = 'critical' | 'warning' | 'normal';
export type DormantRiskLevel = 'active' | 'dormant_warning' | 'dormant_severe';

export type RenewalActionAdvice =
  | 'URGENT_RENEWAL'     // 课时危急，立即发起续费
  | 'WINDOW_OPEN'        // 窗口开启，适时推介方案
  | 'DORMANT_FOLLOWUP'   // 停消异常，优先学管关怀回访
  | 'HEALTHY_LEARNING'   // 消课正常，持续教学看护
  | 'BLOCKED_REFUNDING'; // 退费冻结，风控拦截续费

export interface VisualHealthBadge {
  level: RenewalWarningLevel;
  color: 'danger' | 'warning' | 'success';
  type: 'danger' | 'warning' | 'success';
  label: string;
  text: string;
  cssClass: string;
}

// ============================================================================
// 4. 学员风险与大盘聚合模型
// ============================================================================

export interface RenewalStudentAssetSummary {
  totalRemainingLessons: number;
  totalConsumedLessons: number;
  activePackageCount: number;
  principalBalance: number;
  bonusBalance: number;
}

export interface RenewalConsumptionHealth {
  weeklyBurnRate: number;
  dailyBurnRate: number;
  estimatedDepletionDays: number;
  estimatedDepletionDate: string;
  warningLevel: RenewalWarningLevel;
  visualBadge: VisualHealthBadge;
  lastAttendanceDate: string | null;
  inactiveDays: number;
  dormantRisk: DormantRiskLevel;
  futureScheduledLessons: number;
}

export interface RenewalDecisionInfo {
  renewalWindowOpen: boolean;
  advice: RenewalActionAdvice;
  targetPackageId: string | null;
  targetCourseId: string | null;
  targetCourseName: string | null;
  isRefundLocked: boolean;
  blockingReason?: string;
}

export interface RenewalStudentItem {
  id: string;
  studentId: string;
  studentNo: string;
  studentName: string;
  phone: string;
  campusId: string;
  campusName: string;
  currentStatus: string;
  grade?: string;
  courseId?: string;
  courseName?: string;
  classId?: string;
  className?: string;
  pricePerLesson?: number;
  level: 'urgent' | 'warning' | 'normal';
  reason: string;
  updatedAt: string;
  type: string;
  assetSummary: RenewalStudentAssetSummary;
  consumptionHealth: RenewalConsumptionHealth;
  decision: RenewalDecisionInfo;
}

export interface RenewalDashboardStatistics {
  urgent: number;          // 对齐 UI 紧急数
  warning: number;         // 对齐 UI 重点关注数
  pending: number;         // 对齐 UI 待入班数
  criticalCount: number;   // 紧急预警数 (<=4课时)
  warningCount: number;    // 中危数 (<=8课时)
  normalCount: number;     // 正常数
  dormantCount: number;    // 休眠数 (>=14天未出勤)
  pendingCount: number;    // 待分班学员数
  windowOpenCount: number; // 窗口开放数
  estimatedRenewalPoolAmount: number; // 预估续费总池 (元)
}

export interface RenewalDashboardView {
  total: number;
  page: number;
  pageSize: number;
  statistics: RenewalDashboardStatistics;
  list: RenewalStudentItem[];
}

export interface RenewalDashboardFilter {
  keyword?: string;
  warningLevel?: string;
  riskLevel?: string;
  dormantOnly?: boolean;
  renewalWindowOnly?: boolean;
  classId?: string;
  campusId?: string;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// 5. 续费开单智能草案 (RenewalOrderDraft)
// ============================================================================

export interface RenewalDraftOptions {
  packageId?: string;
  preferredPackageId?: string;
  targetCourseId?: string;
  targetClassId?: string;
  customLessons?: number;
  recommendedLessons?: number;
  bonusLessons?: number;
  pricePerLesson?: number;
  customDiscount?: number;
  paymentMethod?: string;
  operatorId?: string;
  operator?: {
    operatorId?: string;
    operatorName?: string;
  };
}

export interface RenewalQuote {
  courseId: string;
  courseName: string;
  classId: string | null;
  className: string | null;
  totalLessons: number;
  bonusLessons: number;
  pricePerLesson: number;
  originalTotalPrice: number;
  suggestedDiscount: number;
  walletPrincipalBalance: number;
  canUseWalletDeduction: boolean;
  actualPayAmount: number;
  paymentMethod: string;
  remark: string;
}

export interface RenewalValidation {
  pass: boolean;
  isClassFull: boolean;
  isRefundLocked: boolean;
  fallbackUnassigned: boolean; // 原班满员时置位 true 安全回退待分班
  warningMessage?: string;
}

export interface RenewalEnrollCommand {
  studentId: string;
  courseId: string;
  classId?: string;
  totalLessons: number;
  bonusLessons: number;
  pricePerLesson: number;
  discountAmount: number;
  couponAmount: number;
  paymentMethod: string;
  channel: string;
  ownerId?: string;
  remark?: string;
  fallbackUnassigned?: boolean;
}

export interface RenewalOrderDraft {
  draftId: string;
  studentId: string;
  studentName: string;
  studentNo: string;
  studentPhone?: string;
  campusId: string;
  campusName: string;
  createdAt: string;
  quote: RenewalQuote;
  validation: RenewalValidation;
  enrollCommand: RenewalEnrollCommand;
}

// ============================================================================
// 6. 协调器外部接口契约
// ============================================================================

export interface ClientRenewalCoordinatorInterface {
  loadWarningDashboard(filter?: RenewalDashboardFilter): Promise<RenewalDashboardView>;
  prepareRenewalDecision(studentId: string, options?: RenewalDraftOptions): Promise<RenewalOrderDraft>;
  proceedToCheckout(draft: RenewalOrderDraft): Promise<{ success: boolean; url: string; draftId: string }>;
  initiateContact(phone: string, studentName?: string): Promise<{ success: boolean; phone: string; studentName?: string }>;
  getStagedDraft(draftId?: string): RenewalOrderDraft | null;
  stageDraft(draft: RenewalOrderDraft): void;
  clearStagedDraft(draftId?: string): void;
}
