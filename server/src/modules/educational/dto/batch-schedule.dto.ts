import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsIn,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecurrenceRuleDto {
  @IsOptional()
  @IsString()
  @IsIn(['weekly', 'daily', 'custom'])
  frequency?: 'weekly' | 'daily' | 'custom';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(48)
  repeatCount?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customDates?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['step_forward', 'skip', 'ignore'])
  holidayPolicy?: 'step_forward' | 'skip' | 'ignore';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeDates?: string[];
}

export class BatchScheduleIntentDto {
  @IsOptional()
  @IsString()
  campusId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  classIds: string[];

  @IsString()
  @IsNotEmpty()
  startDate: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsString()
  classroomId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceRuleDto)
  recurrence?: RecurrenceRuleDto;

  @IsOptional()
  @IsString()
  @IsIn(['formal', 'make_up', 'trial'])
  classType?: 'formal' | 'make_up' | 'trial';

  @IsOptional()
  @IsString()
  @IsIn(['STRICT_ABORT', 'ALLOW_AND_FLAG'])
  conflictPolicy?: 'STRICT_ABORT' | 'ALLOW_AND_FLAG';

  @IsOptional()
  @IsString()
  excludeScheduleId?: string;

  @IsOptional()
  @IsString()
  operatorName?: string;
}
