import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn, Min } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  cover: string;

  @IsNumber()
  @Min(0)
  pricePerLesson: number;

  @IsNumber()
  @Min(1)
  totalLessons: number;

  @IsString()
  @IsNotEmpty()
  subject: string; // scratch | python | cpp | robotics

  @IsString()
  @IsNotEmpty()
  grade: string; // junior | middle | senior

  @IsString()
  @IsNotEmpty()
  attribute: string; // regular | extended | activity | trial | training

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  campusIds?: string[];
}

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  cover?: string;

  @IsOptional()
  @IsNumber()
  pricePerLesson?: number;

  @IsOptional()
  @IsNumber()
  totalLessons?: number;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  attribute?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCourseStatusDto {
  @IsString()
  @IsIn(['enabled', 'disabled'])
  status: string;
}

export class AuthorizeCampusesDto {
  @IsNotEmpty()
  campusIds: string[];
}

export class CreateCourseUnitDto {
  @IsString()
  @IsNotEmpty()
  unitName: string;

  @IsOptional()
  @IsNumber()
  sort?: number;

  @IsOptional()
  lessons?: {
    lessonName: string;
    durationMin?: number;
    courseware?: string;
    sort?: number;
  }[];
}
