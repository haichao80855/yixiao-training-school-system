/**
 * 课消风控与续费决策协调器领域契约与类型定义
 * Domain Types for LessonRenewalCoordinator
 */

import { EnrollStudentCommand } from './student-enrollment.types';

// ============================================================================
// 1. 核心常量与枚举定义 (SSOT Invariants)
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
  /** 滑动消课速率统计窗口 (近 30 天) */
  SLIDING_BURN_WINDOW_DAYS: 30,
  /** 保底基线周消课流速 (课时/周) */
  MIN_BASELINE_BURN_RATE: 0.5,
  /** 推荐续费标准学期课时档位 */
  RECOMMENDED_SEMESTER_LESSONS: 48,
  /** 推荐续费季度轻量课时档位 */
  RECOMMENDED_QUARTER_LESSONS: 24,
  /** 默认推荐立减优惠 (元) */
  DEFAULT_SUGGESTED_DISCOUNT: 200,
} as const;

/** 课消三色预警等级 */
export type RenewalWarningLevel = 'critical' | 'warning' | 'normal';

/** 停消休眠风险等级 */
export type DormantRiskLevel = 'active' | 'dormant_warning' | 'dormant_severe';

/** 续费决策动作建议 */
export type RenewalActionAdvice =
  | 'URGENT_RENEWAL'     // 课时危急，立即发起续费
  | 'WINDOW_OPEN'        // 窗口开启，适时推介方案
  | 'DORMANT_FOLLOWUP'   // 停消异常，优先学管关怀回访
  | 'HEALTHY_LEARNING'   // 消课正常，持续教学看护
  | 'BLOCKED_REFUNDING'; // 退费冻结，风控拦截续费

/** 权威视觉语义徽章 (UI 直接消费，无魔法数字) */
export interface VisualHealthBadge {
  level: RenewalWarningLevel;
  color: 'danger' | 'warning' | 'success';
  type: 'danger' | 'warning' | 'success';
  label: string;         // 如: "紧急枯竭 (<=4课时)", "预警关注 (<=8课时)", "健康在读"
  text: string;          // 别名兼容前端 visualBadge.text
  cssClass: string;
}

// ============================================================================
// 2. 单学员课消风控全景诊断模型 (StudentRiskDiagnosis)
// ============================================================================

export interface StudentRiskDiagnosis {
  studentId: string;
  studentNo: string;
  studentName: string;
  phone: string;
  campusId: string;
  campusName: string;
  currentStatus: string;
  classId?: string | null;
  className?: string | null;
  courseId?: string | null;
  courseName?: string | null;
  pricePerLesson?: number;

  /** 资产全景快照 */
  assetSummary: {
    totalRemainingLessons: number;
    totalConsumedLessons: number;
    activePackageCount: number;
    principalBalance: number;
    bonusBalance: number;
  };

  /** 课消流速与预测 (SSOT Burning Alerts) */
  consumptionHealth: {
    weeklyBurnRate: number;            // 近 30 天滑动周消课速率 (课时/周)
    dailyBurnRate: number;             // 天均消课速率
    estimatedDepletionDays: number;    // 预计耗尽天数
    estimatedDepletionDate: string;    // 预计耗尽日期 (YYYY-MM-DD)
    warningLevel: RenewalWarningLevel; // 权威三色等级: critical | warning | normal
    visualBadge: VisualHealthBadge;    // 权威视觉语义徽章
    lastAttendanceDate: string | null; // 最近一次出勤消课日期
    inactiveDays: number;              // 连续未消课天数
    dormantRisk: DormantRiskLevel;     // 停消休眠级别
    futureScheduledLessons: number;    // 未来 14 天待上课次
  };

  /** 续费决策卡片 */
  decision: {
    renewalWindowOpen: boolean;        // 续费窗口是否打开
    advice: RenewalActionAdvice;       // 领域动作建议
    targetPackageId: string | null;    // 最急需续费的目标课包 ID
    targetCourseId: string | null;     // 推荐续费课程 ID
    targetCourseName: string | null;
    isRefundLocked: boolean;           // 财务防腐锁定 (ACB)
    blockingReason?: string;           // 阻断原因 (如在途退费)
  };
}

// ============================================================================
// 3. 校区大盘筛选与聚合模型 (CampusRenewalRoster)
// ============================================================================

export interface RenewalRosterQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  classId?: string;
  warningLevel?: RenewalWarningLevel | 'dormant' | 'all';
  riskLevel?: 'all' | 'critical' | 'warning' | 'normal' | 'dormant';
  dormantOnly?: boolean;               // 仅看停消休眠学员
  renewalWindowOnly?: boolean;         // 仅看续费窗口已打开学员
  sortBy?: 'depletion_days' | 'remaining_lessons' | 'inactive_days' | 'risk' | 'urgency' | 'remaining';
  sortOrder?: 'asc' | 'desc';
}

export interface CampusRenewalRosterResult {
  total: number;
  page: number;
  pageSize: number;
  statistics: {
    criticalCount: number;       // 紧急人数 (<= 4 课时)
    warningCount: number;        // 预警人数 (<= 8 课时)
    normalCount: number;         // 正常人数 (> 8 课时)
    dormantCount: number;        // 停消休眠人数 (>= 14 天未消课)
    windowOpenCount: number;     // 窗口开放总人数
    pendingCount?: number;       // 待分班学员人数
    estimatedRenewalPoolAmount?: number; // 预估续费总池 (元)
  };
  list: StudentRiskDiagnosis[];
}

// ============================================================================
// 4. 班级花名册学员健康视图 (ClassRosterHealthReport)
// ============================================================================

export interface ClassRosterStudentHealth {
  studentId: string;
  studentNo: string;
  name: string;
  phone: string;
  packageId?: string;
  courseName?: string;
  remainingLessons: number;
  consumedLessons: number;
  warningLevel: RenewalWarningLevel;  // 权威红/黄/绿标注
  visualBadge: VisualHealthBadge;     // 权威视觉语义徽章
  weeklyBurnRate: number;
  estimatedDepletionDays: number;
  inactiveDays: number;
  isDormant: boolean;
  canQuickRenew: boolean;             // 是否可一键发起续费
}

export interface ClassRosterHealthReport {
  classId: string;
  className: string;
  courseId: string;
  courseName: string;
  teacherName: string;
  capacity: number;
  currentStudentCount: number;
  classHealthIndex: number;           // 班级整体消课健康指数 [0-100]
  statistics: {
    criticalCount: number;
    warningCount: number;
    normalCount: number;
    dormantCount: number;
  };
  roster: ClassRosterStudentHealth[];
}

// ============================================================================
// 5. 续费开单智能预填草案模型 (RenewalOrderDraft)
// ============================================================================

export interface RenewalDraftOptions {
  packageId?: string;                  // 别名兼容 preferredPackageId
  preferredPackageId?: string;         // 指定需续约的原课包
  targetCourseId?: string;             // 指定续报课程 (缺省则继承原课包或高阶进阶课)
  targetClassId?: string;              // 指定承接班级 (缺省则继承原在读班级)
  customLessons?: number;              // 别名兼容 recommendedLessons
  recommendedLessons?: number;         // 指定续约课时数 (缺省推荐 48 课时)
  bonusLessons?: number;               // 协议赠送课时数
  pricePerLesson?: number;             // 指定续费单价
  paymentMethod?: string;              // 偏好支付渠道 (默认 wallet 优先核算)
  customDiscount?: number;             // 特批立减金额
  operatorId?: string;                 // 经办学管/顾问
  operator?: {
    operatorId?: string;
    operatorName?: string;
  };
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

  /** 推荐财务与课程核算明细 */
  quote: {
    courseId: string;
    courseName: string;
    classId: string | null;
    className: string | null;
    totalLessons: number;              // 推荐续约课时数 (如 48)
    bonusLessons: number;              // 协议赠送课时数 (如 2)
    pricePerLesson: number;            // 继承原单价或课程标准单价
    originalTotalPrice: number;        // 原价合计
    suggestedDiscount: number;         // 老带新/连报续费特准减免
    walletPrincipalBalance: number;    // 学员电子钱包本金余额
    canUseWalletDeduction: boolean;    // 是否足以用钱包本金全额抵扣
    actualPayAmount: number;           // 预计最终实付金额
    paymentMethod: string;
    remark: string;
  };

  /** 风控与前置诊断 */
  validation: {
    pass: boolean;
    isClassFull: boolean;              // 原班是否已满员
    isRefundLocked: boolean;           // 是否处于退费锁定
    fallbackUnassigned?: boolean;      // 班容超额安全回退待分班标记
    warningMessage?: string;
  };

  /** 零胶水直通 EnrollStudentCommand */
  enrollCommand: EnrollStudentCommand;
}
