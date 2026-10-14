import { Injectable, Logger } from '@nestjs/common';
import { SettlementStrategy } from './settlement-strategy.interface';
import { RefundSettlementStrategy } from './strategies/refund-settlement.strategy';
import { PaymentSettlementStrategy } from './strategies/payment-settlement.strategy';
import { QuarterlySettlementStrategy } from './strategies/quarterly-settlement.strategy';
import { CourseChangeDiffStrategy } from './strategies/course-change-diff.strategy';
import { WalletPrestoreStrategy } from './strategies/wallet-prestore.strategy';
import { GenericSettlementStrategy } from './strategies/generic-settlement.strategy';

@Injectable()
export class SettlementStrategyRegistry {
  private readonly logger = new Logger(SettlementStrategyRegistry.name);
  private readonly strategies = new Map<string, SettlementStrategy>();

  constructor(
    private readonly refundStrategy: RefundSettlementStrategy,
    private readonly paymentStrategy: PaymentSettlementStrategy,
    private readonly quarterlyStrategy: QuarterlySettlementStrategy,
    private readonly diffStrategy: CourseChangeDiffStrategy,
    private readonly walletStrategy: WalletPrestoreStrategy,
    private readonly genericStrategy: GenericSettlementStrategy,
  ) {
    this.register(this.refundStrategy);
    this.register(this.paymentStrategy);
    this.register(this.quarterlyStrategy);
    this.register(this.diffStrategy);
    this.register(this.walletStrategy);
    this.register(this.genericStrategy);
  }

  /**
   * 注册履约策略
   */
  register(strategy: SettlementStrategy): void {
    this.strategies.set(strategy.businessType, strategy);
    this.logger.log(
      `[SettlementStrategyRegistry] 注册履约策略: [${strategy.businessType}] -> ${strategy.constructor.name}`,
    );
  }

  /**
   * 根据业务类型获取对应的履约策略，若未找到则回退至 default 策略
   */
  getStrategy(businessType: string): SettlementStrategy {
    const strategy = this.strategies.get(businessType);
    if (strategy) {
      return strategy;
    }

    const defaultStrategy = this.strategies.get('default');
    if (defaultStrategy) {
      this.logger.warn(
        `未找到类型 [${businessType}] 的专用履约策略，回退至 default 策略`,
      );
      return defaultStrategy;
    }

    throw new Error(
      `系统未配置业务类型 [${businessType}] 的履约策略，且未注册 default 兜底策略`,
    );
  }

  /**
   * 检查是否已注册特定业务类型策略
   */
  hasStrategy(businessType: string): boolean {
    return this.strategies.has(businessType);
  }

  /**
   * 获取所有已注册的策略类型
   */
  getAllRegisteredTypes(): string[] {
    return Array.from(this.strategies.keys());
  }
}
