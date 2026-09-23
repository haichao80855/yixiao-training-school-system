import { IsString, IsNotEmpty, IsOptional, IsIn, IsNumber, Min } from 'class-validator';

export class CreateMovementDto {
  @IsString()
  @IsIn([
    'transfer_class',
    'change_course',
    'suspend',
    'resume',
    'transfer_campus',
    'transfer_student',
    'refund',
  ])
  type: string;

  @IsOptional()
  @IsString()
  packageId?: string;

  @IsString()
  @IsNotEmpty()
  reasonCategory: string;

  @IsOptional()
  @IsString()
  reasonDetail?: string;

  @IsOptional()
  @IsString()
  targetClassId?: string;

  @IsOptional()
  @IsString()
  targetCourseId?: string;

  @IsOptional()
  @IsString()
  targetCampusId?: string;

  @IsOptional()
  @IsString()
  targetStudentId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  suspendDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  refundAmount?: number;
}
