import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SettlementStrategy,
  SettlementContext,
  SettlementReceipt,
  SettlementRollbackReceipt,
} from '../settlement-strategy.interface';

@Injectable()
export class PaymentSettlementStrategy implements SettlementStrategy {
  private readonly logger = new Logger(PaymentSettlementStrategy.name);
  readonly businessType = 'payment';

  async onFinalized(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementReceipt> {
    this.logger.log(`[PaymentSettlementStrategy] 常规收款终审核准: flowId=${flow.id}, orderId=${order.id}`);

    const payTime = new Date();
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        payTime,
      },
    });

    // 若关联课包处于非 active 状态（如 pending），激活课包
    if (order.packageId) {
      const pkg = await tx.studentCoursePackage.findUnique({
        where: { id: order.packageId },
      });
      if (pkg && pkg.status !== 'active') {
        await tx.studentCoursePackage.update({
          where: { id: pkg.id },
          data: { status: 'active' },
        });
      }
    }

    return {
      success: true,
      businessType: this.businessType,
      orderId: order.id,
      status: 'paid',
      message: `常规收款终审通过，订单确立为 paid 终态，课包已激活`,
      details: { payTime },
    };
  }

  async onRejected(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementRollbackReceipt> {
    this.logger.log(`[PaymentSettlementStrategy] 常规收款被驳回: flowId=${flow.id}, orderId=${order.id}`);

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'rejected' },
    });

    return {
      success: true,
      businessType: this.businessType,
      orderId: order.id,
      status: 'rejected',
      message: `常规收款申请已被驳回，订单已标记为 rejected`,
    };
  }
}
