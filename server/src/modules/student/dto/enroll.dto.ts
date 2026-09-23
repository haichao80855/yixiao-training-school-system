import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsIn } from 'class-validator';

export class EnrollStudentDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsNumber()
  @Min(1)
  totalLessons: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusLessons?: number;

  @IsNumber()
  @Min(0)
  pricePerLesson: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  couponAmount?: number;

  @IsString()
  @IsIn(['wechat', 'alipay', 'bank_transfer', 'pos', 'wallet'])
  paymentMethod: string;

  @IsOptional()
  @IsIn(['ground', 'referral', 'meituan', 'online'])
  channel?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
