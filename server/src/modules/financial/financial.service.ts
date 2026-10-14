import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderFilterDto, UpdateVoucherDto, LockOrderDto, UpdateOrderDto } from './dto/order.dto';
import { CreateApprovalDto, AuditApprovalDto, BatchAuditDto } from './dto/approval.dto';
import { FinancialApprovalOrchestrator } from './domain/financial-approval.orchestrator';

@Injectable()
export class FinancialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalOrchestrator: FinancialApprovalOrchestrator,
  ) {}

  // ----------------------------------------------------------------
  // 1. 财务订单账本与高精算力 Summary Strip
  // ----------------------------------------------------------------

  private buildOrderWhere(query: OrderFilterDto, campusId?: string) {
    const where: any = {};

    const activeCampus = query.campusId || campusId;
    if (activeCampus && activeCampus !== 'all') {
      where.campusId = activeCampus;
    }

    if (query.orderType && query.orderType !== 'all') {
      where.orderType = query.orderType;
    }

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query.paymentMethod && query.paymentMethod !== 'all') {
      where.paymentMethod = query.paymentMethod;
    }

    if (query.deliveryStatus && query.deliveryStatus !== 'all') {
      where.deliveryStatus = query.deliveryStatus;
    }

    if (query.invoiceStatus && query.invoiceStatus !== 'all') {
      where.invoiceStatus = query.invoiceStatus;
    }

    if (query.channel && query.channel !== 'all') {
      where.channel = query.channel;
    }

    if (query.salesOwner && query.salesOwner.trim()) {
      const ownerKeyword = query.salesOwner.trim();
      where.OR = [
        { owner: { realName: { contains: ownerKeyword } } },
        { creator: { realName: { contains: ownerKeyword } } },
      ];
    }

    if (query.minAmount !== undefined && query.minAmount !== null && String(query.minAmount).trim() !== '') {
      const minVal = Number(query.minAmount);
      if (!isNaN(minVal)) {
        where.actualAmount = where.actualAmount || {};
        where.actualAmount.gte = minVal;
      }
    }

    if (query.maxAmount !== undefined && query.maxAmount !== null && String(query.maxAmount).trim() !== '') {
      const maxVal = Number(query.maxAmount);
      if (!isNaN(maxVal)) {
        where.actualAmount = where.actualAmount || {};
        where.actualAmount.lte = maxVal;
      }
    }

    if (query.startDate && query.endDate) {
      where.createdAt = {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate.includes('T') ? query.endDate : `${query.endDate}T23:59:59.999Z`),
      };
    } else if (query.startDate) {
      where.createdAt = {
        gte: new Date(query.startDate),
      };
    } else if (query.endDate) {
      where.createdAt = {
        lte: new Date(query.endDate.includes('T') ? query.endDate : `${query.endDate}T23:59:59.999Z`),
      };
    }

    if (query.keyword && query.keyword.trim()) {
      const kw = query.keyword.trim();
      const kwConditions = [
        { orderNo: { contains: kw } },
        { student: { name: { contains: kw } } },
        { student: { phone: { contains: kw } } },
        { student: { studentNo: { contains: kw } } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: kwConditions }];
        delete where.OR;
      } else {
        where.OR = kwConditions;
      }
    }

    return where;
  }

  /**
   * 订单账本列表分页查询 (原子附加动态实收指标 Summary)
   */
  async getOrders(query: OrderFilterDto, campusId?: string) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const where = this.buildOrderWhere(query, campusId);

    const [total, list, summary] = await Promise.all([
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
      this.getOrderSummary(query, campusId),
    ]);

    return {
      total,
      page,
      pageSize,
      list,
      summary,
    };
  }

  /**
   * 盛通高精度 Summary Strip 动态实收指标统计
   * 严格以整型“分”为单位累加，杜绝 IEEE-754 浮点累加漂移误差
   */
  async getOrderSummary(query: OrderFilterDto, campusId?: string) {
    const where = this.buildOrderWhere(query, campusId);

    const baseQuery = { ...query };
    delete baseQuery.status;
    const baseWhere = this.buildOrderWhere(baseQuery, campusId);

    const [orders, allStatusOrders] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          status: true,
          originalPrice: true,
          discountAmount: true,
          receivableAmount: true,
          actualAmount: true,
        },
      }),
      this.prisma.order.findMany({
        where: baseWhere,
        select: { status: true },
      }),
    ]);

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

    const statusCounts: Record<string, number> = {
      all: allStatusOrders.length,
      paid: 0,
      unpaid: 0,
      rejected: 0,
      void: 0,
    };
    for (const o of allStatusOrders) {
      if (o.status && statusCounts[o.status] !== undefined) {
        statusCounts[o.status]++;
      }
    }

    const totalAmount = actualSumInCents / 100;
    return {
      totalOrders,
      totalPaidOrders,
      totalOriginalAmount: originalSumInCents / 100,
      totalDiscountAmount: discountSumInCents / 100,
      totalActualAmount: totalAmount,
      totalCount: totalOrders,
      totalAmount,
      formattedAmount: totalAmount.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      statusCounts,
      currency: 'CNY',
      summaryText: `当前条件下：共计 ${totalOrders} 笔订单（已支付 ${totalPaidOrders} 笔），实收总额 ¥ ${totalAmount.toFixed(2)} 元`,
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
  // 2. 多级风控审批流中心 (Approval Flow Deep Module Delegation)
  // ----------------------------------------------------------------

  /**
   * 查询审批工单列表
   */
  async getApprovals(query: {
    status?: string;
    businessType?: string;
    currentStep?: number;
    campusId?: string;
    page?: number;
    pageSize?: number;
  }) {
    return this.approvalOrchestrator.getApprovals(query);
  }

  /**
   * 发起多级审批流工单
   */
  async createApprovalFlow(dto: CreateApprovalDto) {
    return this.approvalOrchestrator.submitApproval(dto);
  }

  /**
   * 三级风控审批流转状态机 (委托深模块)
   */
  async auditApproval(
    approvalId: string,
    dto: AuditApprovalDto,
    currentUser: any,
  ) {
    return this.approvalOrchestrator.audit(approvalId, {
      action: dto.action as any,
      comment: dto.comment,
      stepName: dto.stepName,
      reviewerId: currentUser?.id,
      reviewerName: currentUser?.realName || currentUser?.username,
    });
  }

  /**
   * 单请求分块批处理审批 (batchAudit)
   */
  async batchAudit(dto: BatchAuditDto, currentUser: any) {
    return this.approvalOrchestrator.batchAudit(
      dto.approvalIds,
      dto.action as any,
      {
        comment: dto.comment,
        stepName: dto.stepName,
        reviewerId: currentUser?.id,
        reviewerName: currentUser?.realName || currentUser?.username,
      },
    );
  }

  /**
   * 获取审批工单时间轴视图
   */
  async getApprovalTimeline(approvalId: string) {
    return this.approvalOrchestrator.getApprovalTimeline(approvalId);
  }
}
