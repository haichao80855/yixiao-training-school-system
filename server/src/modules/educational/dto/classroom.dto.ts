import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn, Min } from 'class-validator';

export class CreateClassroomDto {
  @IsString()
  @IsNotEmpty()
  campusId: string;

  // 可选：快速建室不填编码时由服务端按 CR-<校区>-<序号> 自动生成
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsIn(['maker', 'computer', 'regular', 'vip'])
  type?: string;

  @IsOptional()
  @IsIn(['available', 'maintenance', 'disabled'])
  status?: string;
}

export class UpdateClassroomDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsIn(['maker', 'computer', 'regular', 'vip'])
  type?: string;

  @IsOptional()
  @IsIn(['available', 'maintenance', 'disabled'])
  status?: string;
}
