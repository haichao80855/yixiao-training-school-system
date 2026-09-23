import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { FinancialService } from './financial.service';
import { OrderFilterDto, UpdateVoucherDto, LockOrderDto } from './dto/order.dto';
import { CreateApprovalDto, AuditApprovalDto } from './dto/approval.dto';
import { CurrentCampus } from '../../common/decorators/current-campus.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  // ----------------------------------------------------------------
  // 1. 财务订单账本与汇总统计
  // ----------------------------------------------------------------

  @Get('orders')
  async getOrders(
    @Query() query: OrderFilterDto,
    @CurrentCampus() headerCampusId?: string,
  ) {
    return this.financialService.getOrders(query, headerCampusId);
  }

  @Get('orders/summary')
  async getOrderSummary(
    @Query() query: OrderFilterDto,
    @CurrentCampus() headerCampusId?: string,
  ) {
    return this.financialService.getOrderSummary(query, headerCampusId);
  }

  @Get('orders/:id')
  async getOrderById(@Param('id') id: string) {
    return this.financialService.getOrderById(id);
  }

  @Patch('orders/:id/voucher')
  async updateVoucher(
    @Param('id') id: string,
    @Body() dto: UpdateVoucherDto,
  ) {
    return this.financialService.updateVoucher(id, dto);
  }

  @Patch('orders/:id/lock')
  async lockOrder(
    @Param('id') id: string,
    @Body() dto: LockOrderDto,
  ) {
    return this.financialService.lockOrder(id, dto);
  }

  @Post('orders/:id/void')
  async voidOrder(@Param('id') id: string) {
    return this.financialService.voidOrder(id);
  }

  // ----------------------------------------------------------------
  // 2. 多级风控审批流中心
  // ----------------------------------------------------------------

  @Get('approvals')
  async getApprovals(
    @Query('status') status?: string,
    @Query('businessType') businessType?: string,
    @Query('currentStep') currentStep?: number,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.financialService.getApprovals({
      status,
      businessType,
      currentStep,
      page,
      pageSize,
    });
  }

  @Post('approvals')
  async createApprovalFlow(@Body() dto: CreateApprovalDto) {
    return this.financialService.createApprovalFlow(dto);
  }

  @Post('approvals/:id/audit')
  async auditApproval(
    @Param('id') id: string,
    @Body() dto: AuditApprovalDto,
    @CurrentUser() user: any,
  ) {
    return this.financialService.auditApproval(id, dto, user);
  }
}
