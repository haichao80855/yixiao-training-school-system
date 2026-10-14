import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SettlementStrategy,
  SettlementContext,
  SettlementReceipt,
  SettlementRollbackReceipt,
} from '../settlement-strategy.interface';

@Injectable()
export class WalletPrestoreStrategy implements SettlementStrategy {
  private readonly logger = new Logger(WalletPrestoreStrategy.name);
  readonly businessType = 'wallet_prestore';

  async onFinalized(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementReceipt> {
    this.logger.log(`[WalletPrestoreStrategy] 钱包预存终审核准: flowId=${flow.id}, orderId=${order.id}`);

    const amount = Math.abs(order.actualAmount ?? order.receivableAmount ?? 0);
    const payTime = new Date();

    // 1. 记入学员电子钱包本金账户
    const wallet = await tx.studentWallet.upsert({
      where: { studentId: order.studentId },
      update: {
        principalBalance: { increment: amount },
      },
      create: {
        studentId: order.studentId,
        principalBalance: amount,
        bonusBalance: 0,
        goldPoints: 0,
      },
    });

    // 2. 写入资金变动流水台账
    await tx.walletLedger.create({
      data: {
        studentId: order.studentId,
        orderNo: order.orderNo,
        type: 'recharge',
        amount,
        principalChange: amount,
        bonusChange: 0,
        description: `审批通过钱包预存充值入账 (订单: ${order.orderNo})`,
        operator: context.operatorName || '财务终审',
      },
    });

    // 3. 确立订单为 paid
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
      message: `钱包预存已终审通过，本金 ¥${amount.toFixed(2)} 已充入学员钱包，生成资金流水`,
      details: { amount, currentBalance: wallet.principalBalance },
    };
  }

  async onRejected(
    flow: any,
    order: any,
    context: SettlementContext,
    tx: Prisma.TransactionClient,
  ): Promise<SettlementRollbackReceipt> {
    this.logger.log(`[WalletPrestoreStrategy] 钱包预存申请被驳回: flowId=${flow.id}, orderId=${order.id}`);

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'rejected' },
    });

    return {
      success: true,
      businessType: this.businessType,
      orderId: order.id,
      status: 'rejected',
      message: `钱包预存申请已被驳回，订单已标记为 rejected`,
    };
  }
}
