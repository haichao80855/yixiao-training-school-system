import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class CreateApprovalDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsIn(['payment', 'quarterly', 'refund', 'transfer', 'wallet_prestore'])
  businessType: string;

  @IsString()
  @IsNotEmpty()
  applicantName: string;
}

export class AuditApprovalDto {
  @IsString()
  @IsIn(['pass', 'reject'])
  action: string;

  @IsString()
  @IsNotEmpty()
  comment: string;

  @IsOptional()
  @IsString()
  stepName?: string;
}
