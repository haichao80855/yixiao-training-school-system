import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SettlementStrategy,
  SettlementContext,
  SettlementReceipt,
  SettlementRollbackReceipt,
} from '../settlement-strategy.interface';

@Injectable()
export class QuarterlySettlementStrategy implements SettlementStrategy {
  private readonly logger = new Logger(QuarterlySettlementStrategy.name);
  readonly businessType = 'quarterly';

  async onFinalized(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementReceipt> {
    this.logger.log(`[QuarterlySettlementStrategy] 季度扣费终审通过: flowId=${flow.id}, orderId=${order.id}`);

    const payTime = new Date();
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        payTime,
      },
    });

    return {
      success: true,
      businessType: this.businessType,
      orderId: order.id,
      status: 'paid',
      message: `季度扣费终审通过，扣费订单已确立为 paid`,
      details: { payTime },
    };
  }

  async onRejected(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementRollbackReceipt> {
    this.logger.log(`[QuarterlySettlementStrategy] 季度扣费被驳回: flowId=${flow.id}, orderId=${order.id}`);

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'rejected' },
    });

    return {
      success: true,
      businessType: this.businessType,
      orderId: order.id,
      status: 'rejected',
      message: `季度扣费申请已驳回，单据标记为 rejected`,
    };
  }
}
