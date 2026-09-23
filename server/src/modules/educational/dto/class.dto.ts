import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsIn } from 'class-validator';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  campusId: string;

  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  teacherId: string;

  @IsOptional()
  @IsString()
  advisorId?: string;

  @IsString()
  @IsNotEmpty()
  classroomId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @IsString()
  @IsNotEmpty()
  startDate: string; // ISO 8601 或 YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  endDate: string;
}

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsString()
  advisorId?: string;

  @IsOptional()
  @IsString()
  classroomId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsIn(['recruiting', 'in_progress', 'completed'])
  status?: string;
}
