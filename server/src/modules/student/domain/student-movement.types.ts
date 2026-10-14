/**
 * ==============================================================================
 * 拓视未来教育「一校教培系统」学员学籍异动深模块领域契约
 * 统一收敛 7 种异动流转（转班、换课、停课、复课、转校、转让、退费）
 * ==============================================================================
 */

export type MovementType =
  | 'transfer_class'    // 1. 转班
  | 'change_course'     // 2. 换课
  | 'suspend'           // 3. 停课 / 休学
  | 'resume'            // 4. 复课
  | 'transfer_campus'   // 5. 转校
  | 'transfer_student'  // 6. 转让
  | 'refund';           // 7. 退费

export interface BaseMovementIntent {
  reasonCategory?: string; // 缺省为 '学业或家庭调整'
  reasonDetail?: string;   // 详细业务说明或备注
}

export interface TransferClassIntent extends BaseMovementIntent {
  type: 'transfer_class';
  packageId: string;
  targetClassId: string;
}

export interface ChangeCourseIntent extends BaseMovementIntent {
  type: 'change_course';
  packageId: string;
  targetCourseId: string;
  newPurchasedLessons?: number; // 拟订购新课课时数，缺省按净值全额折算
}

export interface SuspendIntent extends BaseMovementIntent {
  type: 'suspend';
  suspendDays?: number; // 停课天数，默认 30 天 (7 ~ 365)
}

export interface ResumeIntent extends BaseMovementIntent {
  type: 'resume';
  extendExpiryDays?: number; // 顺延到期日天数，缺省继承上次停课天数或 30 天
  targetClassId?: string;    // 若原班级已结课或满员，可选直接排入新班
}

export interface TransferCampusIntent extends BaseMovementIntent {
  type: 'transfer_campus';
  targetCampusId: string;
}

export interface TransferStudentIntent extends BaseMovementIntent {
  type: 'transfer_student';
  targetStudentId: string;
  packageId?: string;        // 缺省时划转全部有效课包
  transferWallet?: boolean;  // 是否同时划转电子钱包余额，默认 true
}

export interface RefundIntent extends BaseMovementIntent {
  type: 'refund';
  packageId: string;
  deductionFee?: number;       // 扣除教材/违约手续费，默认 0
  customRefundAmount?: number; // 审批特殊调解金额 (可选)
}

/**
 * 可辨识联合类型 (Discriminated Union)
 */
export type MovementIntent =
  | TransferClassIntent
  | ChangeCourseIntent
  | SuspendIntent
  | ResumeIntent
  | TransferCampusIntent
  | TransferStudentIntent
  | RefundIntent;

export interface OperatorContext {
  operatorId?: string;
  operatorName?: string;
  campusId?: string;
}

export interface MovementIssue {
  code: string;
  severity: 'blocking' | 'warning';
  message: string;
  field?: string;
}

export interface MovementFinancialImpact {
  sourceResidualValue: number;    // 源资产剩余净值
  targetRequiredAmount: number;   // 目标需支付金额
  netDiffAmount: number;          // 差额 (正数自动退回本金钱包，负数需补交)
  refundableCashAmount?: number;  // 最终实退金额
  clawbackAmount?: number;        // 赠课超额扣减金
  deductionFee?: number;          // 手续费
  walletBalanceAfter?: {
    principal: number;
    bonus: number;
  };
}

export interface MovementCapacityImpact {
  targetClassId: string;
  targetClassName: string;
  capacity: number;
  currentCount: number;
  afterCount: number;
  remainingSlots: number;
  willExceedCapacity: boolean;
}

/**
 * 零写副作用仿真预演报告
 */
export interface MovementPreview {
  success: boolean;
  canExecute: boolean;
  type: MovementType;
  studentId: string;
  studentName: string;
  blockingIssues: MovementIssue[];
  warnings: MovementIssue[];
  financialImpact?: MovementFinancialImpact;
  capacityImpact?: MovementCapacityImpact;
  requiresApproval: boolean;
  approvalStepSummary?: string;
  details?: Record<string, any>;
}

/**
 * 原子事务落盘执行回执
 */
export interface MovementReceipt {
  success: boolean;
  movementId: string;
  type: MovementType;
  studentId: string;
  studentName?: string;
  executedAt: string;
  status: 'effective' | 'pending_approval';
  orderId?: string;
  orderNo?: string;
  approvalFlowId?: string;
  computedRefundAmount?: number;
  summaryText: string;
  snapshot: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  originalData?: Record<string, any>;
  targetData?: Record<string, any>;
}
