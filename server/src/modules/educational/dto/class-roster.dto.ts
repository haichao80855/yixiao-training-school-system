import { IsString, IsNotEmpty, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class AssignStudentsDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsArray()
  @IsNotEmpty()
  studentIds: string[];

  @IsOptional()
  @IsArray()
  packageIds?: string[];

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class RemoveStudentDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UnassignedRosterQueryDto {
  @IsOptional()
  @IsString()
  campusId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  preferredTime?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
