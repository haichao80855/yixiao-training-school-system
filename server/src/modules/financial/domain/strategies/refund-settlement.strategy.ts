import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SettlementStrategy,
  SettlementContext,
  SettlementReceipt,
  SettlementRollbackReceipt,
} from '../settlement-strategy.interface';
import { StudentEnrollmentCoordinator } from '../../../student/domain/student-enrollment.coordinator';

@Injectable()
export class RefundSettlementStrategy implements SettlementStrategy {
  private readonly logger = new Logger(RefundSettlementStrategy.name);
  readonly businessType = 'refund';

  constructor(
    private readonly enrollmentCoordinator: StudentEnrollmentCoordinator,
  ) {}

  async onFinalized(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementReceipt> {
    this.logger.log(`[RefundSettlementStrategy] 终审核准退费，执行结算: flowId=${flow.id}, orderId=${order.id}`);

    const finalizeReceipt = await this.enrollmentCoordinator.finalizeRefund(
      order.id,
      tx,
    );

    return {
      success: true,
      businessType: this.businessType,
      orderId: order.id,
      status: 'paid',
      message: `退费审批终审通过，退费单据已确立为 paid 终态并核销`,
      details: finalizeReceipt,
    };
  }

  async onRejected(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementRollbackReceipt> {
    this.logger.log(`[RefundSettlementStrategy] 退费审批被驳回，执行资产原路回滚: flowId=${flow.id}, orderId=${order.id}`);

    const rollbackReceipt = await this.enrollmentCoordinator.rollbackRefund(
      order.id,
      tx,
    );

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'rejected' },
    });

    return {
      success: true,
      businessType: this.businessType,
      orderId: order.id,
      status: 'rejected',
      message: `退费单据已标记驳回，原课包资产已权威解冻并恢复可用课时`,
      details: rollbackReceipt,
    };
  }
}
