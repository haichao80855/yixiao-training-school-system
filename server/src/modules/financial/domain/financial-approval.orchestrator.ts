import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SettlementStrategyRegistry } from './settlement-strategy.registry';
import {
  ApprovalAction,
  AuditDecision,
  SingleAuditReceipt,
  BatchAuditReceipt,
  ApprovalTimelineView,
  ApprovalTimelineNode,
  CreateApprovalIntent,
} from './financial-approval.types';

@Injectable()
export class FinancialApprovalOrchestrator {
  private readonly logger = new Logger(FinancialApprovalOrchestrator.name);

  // 标准三级风控审批节点名称规范
  private static readonly STEP_NAMES: Record<number, string> = {
    1: '教学端考勤核实',
    2: '校区校长行政复核',
    3: '财务部资金终审',
  };

  private static readonly STEP_ROLES: Record<number, string> = {
    1: '教学主管/学管',
    2: '校区校长',
    3: '财务总监/出纳',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly strategyRegistry: SettlementStrategyRegistry,
  ) {}

  /**
   * 1. 查询审批工单列表
   */
  async getApprovals(query: {
    status?: string;
    businessType?: string;
    currentStep?: number;
    campusId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.status && query.status !== 'all') where.status = query.status;
    if (query.businessType && query.businessType !== 'all') where.businessType = query.businessType;
    if (query.currentStep) where.currentStep = Number(query.currentStep);
    if (query.campusId && query.campusId !== 'all') {
      where.order = { campusId: query.campusId };
    }

    const [total, list] = await Promise.all([
      this.prisma.approvalFlow.count({ where }),
      this.prisma.approvalFlow.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            include: {
              campus: { select: { id: true, name: true } },
              student: { select: { id: true, name: true, phone: true } },
            },
          },
          nodes: {
            orderBy: { createdAt: 'asc' },
            include: { reviewer: { select: { id: true, realName: true, account: true } } },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      list,
    };
  }

  /**
   * 2. 发起多级风控审批工单
   */
  async submitApproval(intent: CreateApprovalIntent) {
    const order = await this.prisma.order.findUnique({
      where: { id: intent.orderId },
    });
    if (!order) {
      throw new NotFoundException(`未找到对应订单 ID: ${intent.orderId}`);
    }

    const existingFlow = await this.prisma.approvalFlow.findUnique({
      where: { orderId: intent.orderId },
    });
    if (existingFlow) {
      throw new BadRequestException('该订单已存在关联的审批工单，请勿重复发起');
    }

    return this.prisma.approvalFlow.create({
      data: {
        orderId: intent.orderId,
        businessType: intent.businessType,
        currentStep: 1, // 初始第一步：教学核实
        totalSteps: intent.totalSteps || 3, // 三级风控：1教学核实 -> 2校长审批 -> 3财务终审
        status: 'pending',
        applicantName: intent.applicantName,
      },
      include: {
        order: true,
        nodes: true,
      },
    });
  }

  /**
   * 3. 任务型工作台入口：单笔快速通过 (passApproval)
   */
  async passApproval(
    flowId: string,
    options?: {
      comment?: string;
      reviewerId?: string;
      reviewerName?: string;
      stepName?: string;
    },
  ): Promise<SingleAuditReceipt> {
    return this.audit(flowId, {
      action: 'pass',
      comment: options?.comment || '审核通过',
      reviewerId: options?.reviewerId,
      reviewerName: options?.reviewerName,
      stepName: options?.stepName,
    });
  }

  /**
   * 4. 任务型工作台入口：单笔快速驳回 (rejectApproval)
   */
  async rejectApproval(
    flowId: string,
    options: {
      comment: string;
      reviewerId?: string;
      reviewerName?: string;
      stepName?: string;
    },
  ): Promise<SingleAuditReceipt> {
    if (!options.comment || !options.comment.trim()) {
      throw new BadRequestException('驳回操作必须填写明确的批注意见');
    }
    return this.audit(flowId, {
      action: 'reject',
      comment: options.comment.trim(),
      reviewerId: options.reviewerId,
      reviewerName: options.reviewerName,
      stepName: options.stepName,
    });
  }

  /**
   * 5. 核心单事务审批状态机 (audit)
   * 统一闭环节点记录、流转推进、终态防篡改与履约策略 SPI 调度
   */
  async audit(
    flowId: string,
    decision: AuditDecision,
  ): Promise<SingleAuditReceipt> {
    const flow = await this.prisma.approvalFlow.findUnique({
      where: { id: flowId },
      include: { order: true, nodes: true },
    });

    if (!flow) {
      throw new NotFoundException(`未找到审批工单 ID: ${flowId}`);
    }

    // 终态防篡改屏障：已通过或已驳回的单据禁止二次审批
    if (flow.status === 'approved' || flow.status === 'rejected') {
      throw new BadRequestException(
        `该审批单已处于终态 [${flow.status}]，严禁二次篡改操作`,
      );
    }

    const previousStep = flow.currentStep;
    const defaultStepName =
      FinancialApprovalOrchestrator.STEP_NAMES[previousStep] ||
      `第${previousStep}级审批`;
    const stepName = decision.stepName || defaultStepName;

    const normalizedAction: 'pass' | 'reject' =
      decision.action === 'reject' ? 'reject' : 'pass';

    const strategy = this.strategyRegistry.getStrategy(flow.businessType);

    return this.prisma.$transaction(async (tx) => {
      // 1. 确保 reviewerId 具备有效外键关联
      let validReviewerId = decision.reviewerId;
      if (!validReviewerId) {
        const fallbackUser = await tx.user.findFirst({
          select: { id: true, realName: true },
        });
        validReviewerId = fallbackUser?.id || 'system-reviewer';
      }

      // 2. 记录审批节点不可变审计日志
      await tx.approvalNode.create({
        data: {
          approvalFlowId: flow.id,
          step: previousStep,
          stepName,
          reviewerId: validReviewerId,
          action: normalizedAction,
          comment: decision.comment,
        },
      });

      const settlementContext = {
        operatorId: validReviewerId,
        operatorName: decision.reviewerName,
        comment: decision.comment,
      };

      // 3. 状态机推进与分支处理
      if (normalizedAction === 'reject') {
        // 驳回逻辑：工单直接置为 rejected 终态
        const updatedFlow = await tx.approvalFlow.update({
          where: { id: flow.id },
          data: { status: 'rejected' },
          include: { nodes: true },
        });

        // 联动更新关联订单状态为 rejected
        if (flow.orderId) {
          await tx.order.update({
            where: { id: flow.orderId },
            data: { status: 'rejected' },
          });
        }

        // 委托策略执行逆向回滚与资产复原
        const rollbackReceipt = await strategy.onRejected(
          flow,
          flow.order,
          settlementContext,
          tx,
        );

        this.logger.log(
          `[ApprovalOrchestrator] 单据 [${flow.id}] 在第 ${previousStep} 级被驳回，履约策略执行回滚`,
        );

        return {
          success: true,
          flowId: flow.id,
          orderId: flow.orderId,
          action: 'reject',
          previousStep,
          currentStep: previousStep,
          status: 'rejected',
          message: `审批已被驳回，工单流转已终止且资产已原路复原`,
          flow: updatedFlow,
          settlementResult: rollbackReceipt,
        };
      } else {
        // 通过逻辑：检查是否达到终审
        if (previousStep >= flow.totalSteps) {
          // 达到最后一级（3级财务终审）
          const updatedFlow = await tx.approvalFlow.update({
            where: { id: flow.id },
            data: { status: 'approved' },
            include: { nodes: true },
          });

          // 委托策略执行履约记账
          const settlementReceipt = await strategy.onFinalized(
            flow,
            flow.order,
            settlementContext,
            tx,
          );

          this.logger.log(
            `[ApprovalOrchestrator] 单据 [${flow.id}] 三级终审全流程通过，履约策略执行完成`,
          );

          return {
            success: true,
            flowId: flow.id,
            orderId: flow.orderId,
            action: 'pass',
            previousStep,
            currentStep: flow.totalSteps,
            status: 'approved',
            message: `三级风控全流程终审通过！`,
            flow: updatedFlow,
            settlementResult: settlementReceipt,
          };
        } else {
          // 中间步骤推进
          const nextStep = previousStep + 1;
          const updatedFlow = await tx.approvalFlow.update({
            where: { id: flow.id },
            data: { currentStep: nextStep },
            include: { nodes: true },
          });

          if (strategy.onStepPassed) {
            await strategy.onStepPassed(
              flow,
              flow.order,
              previousStep,
              settlementContext,
              tx,
            );
          }

          const nextStepName =
            FinancialApprovalOrchestrator.STEP_NAMES[nextStep] ||
            `第${nextStep}级审批`;

          return {
            success: true,
            flowId: flow.id,
            orderId: flow.orderId,
            action: 'pass',
            previousStep,
            currentStep: nextStep,
            status: 'pending',
            message: `第 ${previousStep} 级【${stepName}】已核准，已流转至第 ${nextStep} 级【${nextStepName}】`,
            flow: updatedFlow,
          };
        }
      }
    });
  }

  /**
   * 6. 单请求分块批处理调度 (batchAudit)
   * 彻底根治前端 Promise.all 循环并发脆弱性，逐笔独立事务安全处理，防行锁死锁
   */
  async batchAudit(
    flowIds: string[],
    action: ApprovalAction,
    options?: {
      comment?: string;
      reviewerId?: string;
      reviewerName?: string;
      stepName?: string;
    },
  ): Promise<BatchAuditReceipt> {
    if (!Array.isArray(flowIds) || flowIds.length === 0) {
      throw new BadRequestException('批量审批请求必须包含至少一个 approvalId');
    }

    const defaultComment =
      action === 'reject' ? '批量驳回' : '批量快速审批通过';
    const comment = options?.comment || defaultComment;

    const items = [];
    let successCount = 0;
    let failedCount = 0;

    for (const flowId of flowIds) {
      try {
        const receipt = await this.audit(flowId, {
          action,
          comment,
          reviewerId: options?.reviewerId,
          reviewerName: options?.reviewerName,
          stepName: options?.stepName,
        });

        items.push({
          flowId,
          success: true,
          status: receipt.status,
          currentStep: receipt.currentStep,
          message: receipt.message,
        });
        successCount++;
      } catch (err: any) {
        this.logger.warn(`批量审批单据 [${flowId}] 推进失败: ${err.message}`);
        items.push({
          flowId,
          success: false,
          error: err.message || '审批推进失败',
        });
        failedCount++;
      }
    }

    return {
      success: failedCount === 0,
      total: flowIds.length,
      successCount,
      failedCount,
      items,
    };
  }

  /**
   * 7. 审批全生命周期结构化时间轴视图 (getApprovalTimeline)
   */
  async getApprovalTimeline(flowId: string): Promise<ApprovalTimelineView> {
    const flow = await this.prisma.approvalFlow.findUnique({
      where: { id: flowId },
      include: {
        order: {
          select: {
            id: true,
            orderNo: true,
            orderType: true,
            actualAmount: true,
            createdAt: true,
          },
        },
        nodes: {
          orderBy: { createdAt: 'asc' },
          include: {
            reviewer: { select: { id: true, realName: true, account: true } },
          },
        },
      },
    });

    if (!flow) {
      throw new NotFoundException(`未找到审批工单 ID: ${flowId}`);
    }

    // 格式化历史审批节点
    const timelineNodes: ApprovalTimelineNode[] = flow.nodes.map((node) => ({
      step: node.step,
      stepName:
        node.stepName ||
        FinancialApprovalOrchestrator.STEP_NAMES[node.step] ||
        `第${node.step}级审批`,
      reviewerId: node.reviewerId,
      reviewerName:
        node.reviewer?.realName || node.reviewer?.account || '系统操作员',
      action: node.action,
      comment: node.comment || '',
      createdAt: node.createdAt.toISOString(),
      isCompleted: true,
      isCurrent: false,
    }));

    return {
      flowId: flow.id,
      orderId: flow.orderId,
      orderNo: flow.order?.orderNo,
      businessType: flow.businessType,
      status: flow.status as any,
      currentStep: flow.currentStep,
      totalSteps: flow.totalSteps,
      applicantName: flow.applicantName,
      createdAt: flow.createdAt.toISOString(),
      nodes: timelineNodes,
      canAudit: flow.status === 'pending',
    };
  }
}
