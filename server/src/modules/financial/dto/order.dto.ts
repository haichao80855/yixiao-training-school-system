import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean, IsNumber, Min } from 'class-validator';

export class OrderFilterDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;

  @IsOptional()
  @IsIn(['regular', 'quarterly', 'change_course_diff', 'refund', 'service_fee', 'wallet_recharge'])
  orderType?: string;

  @IsOptional()
  @IsIn(['paid', 'unpaid', 'rejected', 'void'])
  status?: string;

  @IsOptional()
  @IsString()
  campusId?: string;

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
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
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
