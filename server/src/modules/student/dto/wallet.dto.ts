import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

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
}
