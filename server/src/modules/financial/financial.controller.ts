import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { FinancialService } from './financial.service';
import { OrderFilterDto, UpdateVoucherDto, LockOrderDto, UpdateOrderDto } from './dto/order.dto';
import { CreateApprovalDto, AuditApprovalDto } from './dto/approval.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CampusScope, CampusScopeResult } from '../../common/campus-scope.policy';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('api/financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  // ----------------------------------------------------------------
  // 1. 财务订单账本与汇总统计
  // ----------------------------------------------------------------

  @Get('orders')
  @RequirePermissions('financial:orderManagement')
  async getOrders(
    @Query() query: OrderFilterDto,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    return this.financialService.getOrders(query, scope?.targetCampusId);
  }

  @Get('orders/summary')
  @RequirePermissions('financial:orderManagement')
  async getOrderSummary(
    @Query() query: OrderFilterDto,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    return this.financialService.getOrderSummary(query, scope?.targetCampusId);
  }

  @Get('orders/:id')
  @RequirePermissions('financial:orderManagement')
  async getOrderById(@Param('id') id: string) {
    return this.financialService.getOrderById(id);
  }

  @Put('orders/:id')
  @RequirePermissions('financial:order:voucher')
  async updateOrder(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.financialService.updateOrder(id, dto, user);
  }

  @Patch('orders/:id/voucher')
  @RequirePermissions('financial:order:voucher')
  async updateVoucher(
    @Param('id') id: string,
    @Body() dto: UpdateVoucherDto,
  ) {
    return this.financialService.updateVoucher(id, dto);
  }

  @Patch('orders/:id/lock')
  @RequirePermissions('financial:order:lock')
  async lockOrder(
    @Param('id') id: string,
    @Body() dto: LockOrderDto,
  ) {
    return this.financialService.lockOrder(id, dto);
  }

  @Post('orders/:id/void')
  @RequirePermissions('financial:order:void')
  async voidOrder(@Param('id') id: string) {
    return this.financialService.voidOrder(id);
  }

  // ----------------------------------------------------------------
  // 2. 多级风控审批流中心
  // ----------------------------------------------------------------

  @Get('approvals')
  @RequirePermissions('financial:approvalFlow')
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
  @RequirePermissions('financial:approvalFlow')
  async createApprovalFlow(@Body() dto: CreateApprovalDto) {
    return this.financialService.createApprovalFlow(dto);
  }

  @Post('approvals/:id/audit')
  @RequirePermissions('financial:approval:audit')
  async auditApproval(
    @Param('id') id: string,
    @Body() dto: AuditApprovalDto,
    @CurrentUser() user: any,
  ) {
    return this.financialService.auditApproval(id, dto, user);
  }
}
