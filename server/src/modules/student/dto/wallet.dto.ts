import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RechargeWalletDto {
  @IsNumber()
  @Min(0.01)
  amount: number; // 充值本金，必须大于 0

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonus?: number; // 赠送金，默认 0

  @IsOptional()
  @IsString()
  operator?: string; // 操作人员

  @IsOptional()
  @IsString()
  remark?: string; // 备注说明
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string; // 前端打开表单时生成，重试和连点共用，保证同一笔只执行一次
}

export class WithdrawWalletDto {
  @IsNumber()
  @Min(0.01)
  amount: number; // 提现金额，必须大于 0

  @IsOptional()
  @IsString()
  reason?: string; // 提现原因

  @IsOptional()
  @IsString()
  operator?: string; // 操作人员

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string; // 前端打开表单时生成，重试和连点共用，保证同一笔只执行一次
}
