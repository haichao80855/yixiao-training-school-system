import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SettlementStrategy,
  SettlementContext,
  SettlementReceipt,
  SettlementRollbackReceipt,
} from '../settlement-strategy.interface';

@Injectable()
export class CourseChangeDiffStrategy implements SettlementStrategy {
  private readonly logger = new Logger(CourseChangeDiffStrategy.name);
  readonly businessType = 'course_change_diff';

  async onFinalized(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementReceipt> {
    this.logger.log(`[CourseChangeDiffStrategy] 换课差额终审通过: flowId=${flow.id}, orderId=${order.id}`);

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
      message: `换课差额审批通过，差额单据已置为 paid 终态`,
      details: { payTime },
    };
  }

  async onRejected(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementRollbackReceipt> {
    this.logger.log(`[CourseChangeDiffStrategy] 换课差额被驳回: flowId=${flow.id}, orderId=${order.id}`);

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'rejected' },
    });

    return {
      success: true,
      businessType: this.businessType,
      orderId: order.id,
      status: 'rejected',
      message: `换课差额单据已被驳回，状态更新为 rejected`,
    };
  }
}
