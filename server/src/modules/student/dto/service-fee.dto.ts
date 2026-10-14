import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsIn, Min } from 'class-validator';

export class CreateServiceFeeDto {
  @IsOptional()
  @IsString()
  certNo?: string;

  @IsNotEmpty({ message: '学员 ID 不能为空' })
  @IsString()
  studentId: string;

  @IsNotEmpty({ message: '学员姓名不能为空' })
  @IsString()
  studentName: string;

  @IsNotEmpty({ message: '学号不能为空' })
  @IsString()
  studentNo: string;

  @IsNotEmpty({ message: '校区 ID 不能为空' })
  @IsString()
  campusId: string;

  @IsOptional()
  @IsString()
  campusName?: string;

  @IsNotEmpty({ message: '报考科目/竞赛项目不能为空' })
  @IsString()
  examType: string;

  @IsNotEmpty({ message: '项目类别不能为空' })
  @IsIn(['certification', 'competition'])
  category: string;

  @IsNotEmpty({ message: '报考考务费金额不能为空' })
  @IsNumber()
  @Min(0, { message: '费用金额不得小于 0' })
  fee: number;

  @IsOptional()
  @IsString()
  invoiceTitle?: string;

  @IsOptional()
  @IsString()
  yikuaibaoVoucherNo?: string;

  @IsOptional()
  @IsString()
  voucherImage?: string;
}

export class VerifyServiceFeeDto {
  @IsNotEmpty({ message: '考务单据 ID 不能为空' })
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  yikuaibaoVoucherNo?: string;

  @IsOptional()
  @IsString()
  operator?: string;
}

export class BatchVerifyServiceFeeDto {
  @IsArray({ message: '核销 ID 列表必须是数组' })
  @IsString({ each: true, message: '核销 ID 必须是字符串' })
  ids: string[];

  @IsOptional()
  @IsString()
  yikuaibaoVoucherNo?: string;

  @IsOptional()
  @IsString()
  operator?: string;
}

export class ServiceFeeFilterDto {
  @IsOptional()
  @IsString()
  campusId?: string;

  @IsOptional()
  @IsIn(['all', 'pending', 'verified'])
  status?: string;

  @IsOptional()
  @IsIn(['all', 'certification', 'competition'])
  category?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}
