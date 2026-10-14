import { IsString, IsNotEmpty, IsIn, IsOptional, IsArray } from 'class-validator';

export class CreateApprovalDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsIn(['payment', 'quarterly', 'refund', 'transfer', 'wallet_prestore', 'make_over', 'service_fee'])
  businessType: string;

  @IsString()
  @IsNotEmpty()
  applicantName: string;
}

export class AuditApprovalDto {
  @IsString()
  @IsIn(['pass', 'reject', 'approve'])
  action: string;

  @IsString()
  @IsNotEmpty()
  comment: string;

  @IsOptional()
  @IsString()
  stepName?: string;
}

export class BatchAuditDto {
  @IsArray()
  @IsNotEmpty()
  approvalIds: string[];

  @IsString()
  @IsIn(['pass', 'reject', 'approve'])
  action: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  stepName?: string;
}
