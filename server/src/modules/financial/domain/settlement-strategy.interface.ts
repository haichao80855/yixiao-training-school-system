import { Prisma } from '@prisma/client';

export interface SettlementContext {
  operatorId?: string;
  operatorName?: string;
  comment?: string;
}

export interface SettlementReceipt {
  success: boolean;
  businessType: string;
  orderId: string;
  status: string;
  message: string;
  details?: Record<string, any>;
}

export interface SettlementRollbackReceipt {
  success: boolean;
  businessType: string;
  orderId: string;
  status: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * 履约记账策略 SPI (Service Provider Interface)
 * 用于将特定业务的通过结算、驳回回滚、前置校验等逻辑从主审批流状态机中彻底解耦
 */
export interface SettlementStrategy {
  /**
   * 业务类型标识，如 refund, payment, quarterly, course_change_diff, wallet_prestore, default
   */
  readonly businessType: string;

  /**
   * 审批通过或驳回前置校验
   */
  validatePrerequisites?(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * 中间审批步骤核准通过触发的钩子（可选）
   */
  onStepPassed?(
    flow: any,
    order: any,
    step: number,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * 终审通过时的履约记账逻辑
   */
  onFinalized(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementReceipt>;

  /**
   * 任何步骤被驳回时的逆向回滚与资产复原逻辑
   */
  onRejected(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementRollbackReceipt>;
}
