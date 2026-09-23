import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn, Min } from 'class-validator';

export class CreateClassroomDto {
  @IsString()
  @IsNotEmpty()
  campusId: string;

  @IsString()
  @IsNotEmpty()
  code: string;

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
