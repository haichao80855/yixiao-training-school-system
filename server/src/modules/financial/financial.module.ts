import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';

import { StudentModule } from '../student/student.module';
import { FinancialApprovalOrchestrator } from './domain/financial-approval.orchestrator';
import { SettlementStrategyRegistry } from './domain/settlement-strategy.registry';
import { RefundSettlementStrategy } from './domain/strategies/refund-settlement.strategy';
import { PaymentSettlementStrategy } from './domain/strategies/payment-settlement.strategy';
import { QuarterlySettlementStrategy } from './domain/strategies/quarterly-settlement.strategy';
import { CourseChangeDiffStrategy } from './domain/strategies/course-change-diff.strategy';
import { WalletPrestoreStrategy } from './domain/strategies/wallet-prestore.strategy';
import { GenericSettlementStrategy } from './domain/strategies/generic-settlement.strategy';
import { AdminDashboardAggregator } from './domain/admin-dashboard.aggregator';
import { TeacherPayCoordinator } from './domain/teacher-pay.coordinator';
import { TeacherPayController } from './teacher-pay.controller';

@Module({
  imports: [StudentModule],
  controllers: [FinancialController, TeacherPayController],
  providers: [
    FinancialService,
    SettlementStrategyRegistry,
    RefundSettlementStrategy,
    PaymentSettlementStrategy,
    QuarterlySettlementStrategy,
    CourseChangeDiffStrategy,
    WalletPrestoreStrategy,
    GenericSettlementStrategy,
    FinancialApprovalOrchestrator,
    AdminDashboardAggregator,
    TeacherPayCoordinator,
  ],
  exports: [FinancialService, FinancialApprovalOrchestrator],
})
export class FinancialModule {}
