import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean } from 'class-validator';

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

export class UpdateVoucherDto {
  @IsString()
  @IsNotEmpty()
  voucherUrl: string;
}

export class LockOrderDto {
  @IsBoolean()
  isLocked: boolean;
}
