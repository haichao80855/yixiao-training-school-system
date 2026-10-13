import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderFilterDto, UpdateVoucherDto, LockOrderDto, UpdateOrderDto } from './dto/order.dto';
import { CreateApprovalDto, AuditApprovalDto } from './dto/approval.dto';

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------------
  // 1. 财务订单账本与高精算力 Summary Strip
  // ----------------------------------------------------------------

  private buildOrderWhere(query: OrderFilterDto, campusId?: string) {
    const where: any = {};

    const activeCampus = query.campusId || campusId;
    if (activeCampus && activeCampus !== 'all') {
      where.campusId = activeCampus;
    }

    if (query.orderType) {
      where.orderType = query.orderType;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod;
    }

    if (query.deliveryStatus) {
      where.deliveryStatus = query.deliveryStatus;
    }

    if (query.invoiceStatus) {
      where.invoiceStatus = query.invoiceStatus;
    }

    if (query.startDate && query.endDate) {
      where.createdAt = {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate),
      };
    }

    if (query.keyword) {
      where.OR = [
        { orderNo: { contains: query.keyword } },
        { student: { name: { contains: query.keyword } } },
        { student: { phone: { contains: query.keyword } } },
      ];
    }

    return where;
  }

  /**
   * 订单账本列表分页查询
   */
  async getOrders(query: OrderFilterDto, campusId?: string) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const where = this.buildOrderWhere(query, campusId);

    const [total, list] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          campus: { select: { id: true, name: true, code: true } },
          student: { select: { id: true, name: true, phone: true, studentNo: true } },
          creator: { select: { id: true, realName: true } },
          owner: { select: { id: true, realName: true } },
          approval: {
            select: {
              id: true,
              businessType: true,
              currentStep: true,
              totalSteps: true,
              status: true,
            },
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
   * 盛通高精度 Summary Strip 动态实收指标统计
   * 严格以整型“分”为单位累加，杜绝 IEEE-754 浮点累加漂移误差
   */
  async getOrderSummary(query: OrderFilterDto, campusId?: string) {
    const where = this.buildOrderWhere(query, campusId);

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        status: true,
        originalPrice: true,
        discountAmount: true,
        receivableAmount: true,
        actualAmount: true,
      },
    });

    let totalOrders = orders.length;
    let totalPaidOrders = 0;
    let originalSumInCents = 0;
    let discountSumInCents = 0;
    let actualSumInCents = 0;

    for (const ord of orders) {
      if (ord.status === 'paid') {
        totalPaidOrders++;
      }
      originalSumInCents += Math.round(ord.originalPrice * 100);
      discountSumInCents += Math.round((ord.discountAmount || 0) * 100);
      actualSumInCents += Math.round(ord.actualAmount * 100);
    }

    return {
      totalOrders,
      totalPaidOrders,
      totalOriginalAmount: originalSumInCents / 100,
      totalDiscountAmount: discountSumInCents / 100,
      totalActualAmount: actualSumInCents / 100,
      currency: 'CNY',
      summaryText: `当前条件下：共计 ${totalOrders} 笔订单（已支付 ${totalPaidOrders} 笔），实收总额 ¥ ${(actualSumInCents / 100).toFixed(2)} 元`,
    };
  }

  /**
   * 获取单笔订单详情与关联流转
   */
  async getOrderById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        campus: true,
        student: {
          include: {
            wallet: true,
            packages: { include: { course: true } },
          },
        },
        creator: { select: { id: true, realName: true, phone: true } },
        owner: { select: { id: true, realName: true, phone: true } },
        approval: {
          include: {
            nodes: {
              orderBy: { createdAt: 'asc' },
              include: { reviewer: { select: { id: true, realName: true } } },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`订单 ID: ${id} 不存在`);
    }

    return order;
  }

  /**
   * 订单信息修改 (带财务封账锁与作废保护)
   */
  async updateOrder(id: string, dto: UpdateOrderDto, currentUser?: any) {
    const order = await this.getOrderById(id);

    if (order.isLocked) {
      throw new BadRequestException('该订单账期已被财务加锁保护，禁止修改');
    }

    if (order.status === 'void') {
      throw new BadRequestException('已作废的订单严禁修改');
    }

    const updateData: any = {};
    if (dto.actualAmount !== undefined) updateData.actualAmount = dto.actualAmount;
    if (dto.originalPrice !== undefined) updateData.originalPrice = dto.originalPrice;
    if (dto.discountAmount !== undefined) updateData.discountAmount = dto.discountAmount;
    if (dto.couponAmount !== undefined) updateData.couponAmount = dto.couponAmount;
    if (dto.paymentMethod) updateData.paymentMethod = dto.paymentMethod;
    if (dto.deliveryStatus) updateData.deliveryStatus = dto.deliveryStatus;
    if (dto.invoiceStatus) updateData.invoiceStatus = dto.invoiceStatus;
    if (dto.creatorId) updateData.creatorId = dto.creatorId;
    if (dto.ownerId) updateData.ownerId = dto.ownerId;
    if (dto.channel) updateData.channel = dto.channel;
    if (dto.voucherUrl) updateData.voucherUrl = dto.voucherUrl;

    // 附言与备注合并逻辑
    if (dto.remark !== undefined) {
      updateData.remark = dto.remark;
    }
    if (dto.auditRemark) {
      const auditorName = dto.auditor || currentUser?.realName || '财务专员';
      const auditNote = `[凭证审核 ${auditorName}]: ${dto.auditRemark}`;
      updateData.remark = updateData.remark
        ? `${updateData.remark} | ${auditNote}`
        : (order.remark ? `${order.remark} | ${auditNote}` : auditNote);
    }

    return this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        campus: true,
        student: true,
        creator: { select: { id: true, realName: true } },
        owner: { select: { id: true, realName: true } },
      },
    });
  }

  /**
   * 上传/维护收款凭证 (支持附言同步落库)
   */
  async updateVoucher(id: string, dto: UpdateVoucherDto) {
    const order = await this.getOrderById(id);
    if (order.isLocked) {
      throw new BadRequestException('该订单账期已加锁封账，禁止修改凭证');
    }

    const updateData: any = { voucherUrl: dto.voucherUrl };
    if (dto.auditRemark) {
      const auditorName = dto.auditor || '财务专员';
      const auditNote = `[凭证审核 ${auditorName}]: ${dto.auditRemark}`;
      updateData.remark = order.remark ? `${order.remark} | ${auditNote}` : auditNote;
    }

    return this.prisma.order.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * 财务账期加锁保护
   */
  async lockOrder(id: string, dto: LockOrderDto) {
    await this.getOrderById(id);

    return this.prisma.order.update({
      where: { id },
      data: { isLocked: dto.isLocked },
    });
  }

  /**
   * 订单作废冲正 (Void Order)
   */
  async voidOrder(id: string) {
    const order = await this.getOrderById(id);
    if (order.isLocked) {
      throw new BadRequestException('该订单账期已被财务加锁保护，严禁作废冲正');
    }
    if (order.status === 'void') {
      throw new BadRequestException('该订单已被作废，请勿重复操作');
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: 'void' },
    });
  }

  // ----------------------------------------------------------------
  // 2. 多级风控审批流中心 (Approval Flow)
  // ----------------------------------------------------------------

  /**
   * 查询审批工单列表
   */
  async getApprovals(query: {
    status?: string;
    businessType?: string;
    currentStep?: number;
    page?: number;
    pageSize?: number;
  }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.businessType) where.businessType = query.businessType;
    if (query.currentStep) where.currentStep = Number(query.currentStep);

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
            include: { reviewer: { select: { id: true, realName: true } } },
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
   * 发起多级审批流工单
   */
  async createApprovalFlow(dto: CreateApprovalDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) {
      throw new NotFoundException(`未找到对应订单 ID: ${dto.orderId}`);
    }

    const existingFlow = await this.prisma.approvalFlow.findUnique({
      where: { orderId: dto.orderId },
    });
    if (existingFlow) {
      throw new BadRequestException('该订单已存在关联的审批工单，请勿重复发起');
    }

    return this.prisma.approvalFlow.create({
      data: {
        orderId: dto.orderId,
        businessType: dto.businessType,
        currentStep: 1, // 初始第一步：教学核实
        totalSteps: 3,  // 三级风控：1教学核实 -> 2校长审批 -> 3财务终审
        status: 'pending',
        applicantName: dto.applicantName,
      },
      include: {
        order: true,
        nodes: true,
      },
    });
  }

  /**
   * 三级风控审批流转状态机
   */
  async auditApproval(
    approvalId: string,
    dto: AuditApprovalDto,
    currentUser: any,
  ) {
    const flow = await this.prisma.approvalFlow.findUnique({
      where: { id: approvalId },
      include: { order: true, nodes: true },
    });

    if (!flow) {
      throw new NotFoundException(`未找到审批工单 ID: ${approvalId}`);
    }

    // 终态防篡改屏障：已通过或已驳回的单据禁止重复审批
    if (flow.status === 'approved' || flow.status === 'rejected') {
      throw new BadRequestException(`该审批单已处于终态 [${flow.status}]，严禁二次篡改操作`);
    }

    const stepNames: Record<number, string> = {
      1: '教学端考勤核实',
      2: '校区校长行政复核',
      3: '财务部资金终审',
    };
    const stepName = dto.stepName || stepNames[flow.currentStep] || `第${flow.currentStep}级审批`;

    return this.prisma.$transaction(async (tx) => {
      // 1. 记录审批节点历史
      await tx.approvalNode.create({
        data: {
          approvalFlowId: flow.id,
          step: flow.currentStep,
          stepName,
          reviewerId: currentUser?.id || 'system-reviewer',
          action: dto.action,
          comment: dto.comment,
        },
      });

      // 2. 状态机推进逻辑
      if (dto.action === 'reject') {
        // 任何一步驳回，审批流直接终止并置为 rejected
        const updatedFlow = await tx.approvalFlow.update({
          where: { id: flow.id },
          data: { status: 'rejected' },
          include: { nodes: true },
        });

        return {
          success: true,
          status: 'rejected',
          currentStep: flow.currentStep,
          message: `审批已被驳回，工单流转已终止`,
          flow: updatedFlow,
        };
      } else {
        // 通过操作：如果当前已是最后一步 (3: 财务终审)，则全流程完结通过
        if (flow.currentStep >= flow.totalSteps) {
          const updatedFlow = await tx.approvalFlow.update({
            where: { id: flow.id },
            data: { status: 'approved' },
            include: { nodes: true },
          });

          return {
            success: true,
            status: 'approved',
            currentStep: flow.totalSteps,
            message: `三级风控全流程终审通过！`,
            flow: updatedFlow,
          };
        } else {
          // 否则推进到下一审批节点
          const nextStep = flow.currentStep + 1;
          const updatedFlow = await tx.approvalFlow.update({
            where: { id: flow.id },
            data: { currentStep: nextStep },
            include: { nodes: true },
          });

          return {
            success: true,
            status: 'pending',
            currentStep: nextStep,
            message: `第 ${flow.currentStep} 级【${stepName}】已核准，已流转至第 ${nextStep} 级【${stepNames[nextStep]}】`,
            flow: updatedFlow,
          };
        }
      }
    });
  }
}
