import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderFilterDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;

  @IsOptional()
  @IsIn(['all', 'regular', 'quarterly', 'change_course_diff', 'refund', 'service_fee', 'wallet_recharge'])
  orderType?: string;

  @IsOptional()
  @IsIn(['all', 'paid', 'unpaid', 'rejected', 'void'])
  status?: string;

  @IsOptional()
  @IsString()
  campusId?: string;

  @IsOptional()
  @IsIn(['all', 'wechat', 'alipay', 'bank_transfer', 'pos', 'wallet'])
  paymentMethod?: string;

  @IsOptional()
  @IsIn(['all', 'delivered', 'undelivered', 'none'])
  deliveryStatus?: string;

  @IsOptional()
  @IsIn(['all', 'unissued', 'issued', 'processing'])
  invoiceStatus?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  salesOwner?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  couponAmount?: number;

  @IsOptional()
  @IsIn(['wechat', 'alipay', 'bank_transfer', 'pos', 'wallet'])
  paymentMethod?: string;

  @IsOptional()
  @IsIn(['delivered', 'undelivered', 'none'])
  deliveryStatus?: string;

  @IsOptional()
  @IsIn(['unissued', 'issued', 'processing'])
  invoiceStatus?: string;

  @IsOptional()
  @IsString()
  creatorId?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  voucherUrl?: string;

  @IsOptional()
  @IsString()
  auditRemark?: string;

  @IsOptional()
  @IsString()
  auditor?: string;
}

export class UpdateVoucherDto {
  @IsString()
  @IsNotEmpty()
  voucherUrl: string;

  @IsOptional()
  @IsString()
  auditRemark?: string;

  @IsOptional()
  @IsString()
  auditor?: string;
}

export class LockOrderDto {
  @IsBoolean()
  isLocked: boolean;
}
