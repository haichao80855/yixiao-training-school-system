import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SettlementStrategy,
  SettlementContext,
  SettlementReceipt,
  SettlementRollbackReceipt,
} from '../settlement-strategy.interface';

@Injectable()
export class GenericSettlementStrategy implements SettlementStrategy {
  private readonly logger = new Logger(GenericSettlementStrategy.name);
  readonly businessType = 'default';

  async onFinalized(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementReceipt> {
    this.logger.log(`[GenericSettlementStrategy] 通用业务终审通过: flowId=${flow.id}, orderId=${order.id}, bizType=${flow.businessType}`);

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
      businessType: flow.businessType || this.businessType,
      orderId: order.id,
      status: 'paid',
      message: `单据终审通过，订单状态已确立为 paid`,
      details: { payTime },
    };
  }

  async onRejected(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementRollbackReceipt> {
    this.logger.log(`[GenericSettlementStrategy] 通用业务被驳回: flowId=${flow.id}, orderId=${order.id}, bizType=${flow.businessType}`);

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'rejected' },
    });

    return {
      success: true,
      businessType: flow.businessType || this.businessType,
      orderId: order.id,
      status: 'rejected',
      message: `单据已被驳回，订单已标记为 rejected`,
    };
  }
}
