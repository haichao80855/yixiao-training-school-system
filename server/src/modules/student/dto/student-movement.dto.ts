import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { MovementIntent, MovementType } from '../domain/student-movement.types';

export class StudentMovementIntentDto {
  @IsOptional()
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
  type?: MovementType;

  // 兼容 legacy movementType 字段
  @IsOptional()
  @IsString()
  movementType?: MovementType;

  @IsOptional()
  @IsString()
  packageId?: string;

  @IsOptional()
  @IsString()
  reasonCategory?: string;

  @IsOptional()
  @IsString()
  reasonDetail?: string;

  // 转班
  @IsOptional()
  @IsString()
  targetClassId?: string;

  @IsOptional()
  @IsString()
  toClassId?: string;

  // 换课
  @IsOptional()
  @IsString()
  targetCourseId?: string;

  @IsOptional()
  @IsString()
  newCourseId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  newPurchasedLessons?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  newLessons?: number;

  // 停课/复课
  @IsOptional()
  @IsNumber()
  @Min(1)
  suspendDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  suspensionDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  days?: number;

  @IsOptional()
  @IsNumber()
  extendExpiryDays?: number;

  // 转校
  @IsOptional()
  @IsString()
  targetCampusId?: string;

  // 转让
  @IsOptional()
  @IsString()
  targetStudentId?: string;

  @IsOptional()
  @IsBoolean()
  transferWallet?: boolean;

  // 退费
  @IsOptional()
  @IsNumber()
  @Min(0)
  deductionFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  customRefundAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  /**
   * 将宽松兼容的入参标准化为强类型 MovementIntent，注入默认值
   */
  toIntent(): MovementIntent {
    const rawType = this.type || this.movementType || 'transfer_class';
    const reasonCategory = this.reasonCategory || '学业或家庭调整';
    const reasonDetail = this.reasonDetail || '';

    switch (rawType) {
      case 'transfer_class':
        return {
          type: 'transfer_class',
          packageId: this.packageId || '',
          targetClassId: this.targetClassId || this.toClassId || '',
          reasonCategory,
          reasonDetail,
        };

      case 'change_course':
        return {
          type: 'change_course',
          packageId: this.packageId || '',
          targetCourseId: this.targetCourseId || this.newCourseId || '',
          newPurchasedLessons: this.newPurchasedLessons || this.newLessons,
          reasonCategory,
          reasonDetail,
        };

      case 'suspend':
        return {
          type: 'suspend',
          suspendDays: this.suspendDays || this.suspensionDays || this.days || 30,
          reasonCategory,
          reasonDetail,
        };

      case 'resume':
        return {
          type: 'resume',
          extendExpiryDays: this.extendExpiryDays,
          targetClassId: this.targetClassId || this.toClassId,
          reasonCategory,
          reasonDetail,
        };

      case 'transfer_campus':
        return {
          type: 'transfer_campus',
          targetCampusId: this.targetCampusId || '',
          reasonCategory,
          reasonDetail,
        };

      case 'transfer_student':
        return {
          type: 'transfer_student',
          targetStudentId: this.targetStudentId || '',
          packageId: this.packageId,
          transferWallet: this.transferWallet !== false,
          reasonCategory,
          reasonDetail,
        };

      case 'refund':
        return {
          type: 'refund',
          packageId: this.packageId || '',
          deductionFee: this.deductionFee !== undefined ? this.deductionFee : 0,
          customRefundAmount: this.customRefundAmount ?? this.refundAmount,
          reasonCategory,
          reasonDetail,
        };

      default:
        return {
          type: rawType as any,
          reasonCategory,
          reasonDetail,
        } as any;
    }
  }
}
