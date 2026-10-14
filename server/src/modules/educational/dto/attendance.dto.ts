import { IsString, IsNotEmpty, IsArray, ValidateNested, IsIn, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RollCallItemDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsIn(['present', 'leave', 'absent', 'late'])
  status: 'present' | 'leave' | 'absent' | 'late';

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductLessons?: number;

  @IsOptional()
  @IsString()
  packageId?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsIn(['A+', 'A', 'B+', 'B'])
  rating?: string;
}

export class RollCallDto {
  @IsString()
  @IsNotEmpty()
  scheduleEventId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RollCallItemDto)
  items: RollCallItemDto[];
}
