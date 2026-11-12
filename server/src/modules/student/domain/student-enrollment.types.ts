/**
 * 招生签约履约协调器领域契约与 DTO 定义
 * Domain Types for StudentEnrollmentCoordinator
 */

export interface EnrollStudentCommand {
  studentId: string;
  courseId: string;
  classId?: string;
  totalLessons: number;
  bonusLessons?: number;
  pricePerLesson?: number;
  discountAmount?: number;
  couponAmount?: number;
  paymentMethod: 'wechat' | 'alipay' | 'bank_transfer' | 'pos' | 'wallet' | string;
  channel?: 'ground' | 'referral' | 'meituan' | 'online' | string;
  ownerId?: string;
  remark?: string;
}

export interface EnrollmentReceipt {
  success: boolean;
  orderNo: string;
  orderId: string;
  packageId: string;
  classId?: string | null;
  className?: string | null;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  actualAmount: number;
  totalLessons: number;
  bonusLessons: number;
  assignedClass: boolean;
  /** 老学员续报同一课程，新课包并入原班级 (不占新名额) */
  renewalMerged: boolean;
  walletPaid: boolean;
}

/** 报读预检结果 */
export interface EnrollmentPreview {
  /** 学员在这门课已有在读课包或仍在班 (续费) */
  isRenewal: boolean;
  /** 新课包将并入的班级；null 表示进待分班 */
  classId: string | null;
  className: string | null;
  /** 这门课在读课包 (active / frozen) 的剩余课时合计 */
  remainingLessons: number;
  livePackageCount: number;
}

export interface RefundInitiationCommand {
  studentId: string;
  packageId: string;
  reasonCategory: string;
  reasonDetail?: string;
  refundAmount?: number;
}

export interface RefundInitiationReceipt {
  success: boolean;
  movementId: string;
  orderId: string;
  orderNo: string;
  packageId: string;
  approvalFlowId: string;
  computedRefundAmount: number;
  paidRemainingLessons: number;
  bonusLessonsDeducted: number;
  type: 'refund';
  originalData: Record<string, any>;
  targetData: Record<string, any>;
}

export interface RollbackRefundReceipt {
  orderId: string;
  packageId: string;
  restoredStatus: string;
  restoredLessons: number;
}

export interface FinalizeRefundReceipt {
  orderId: string;
  orderNo: string;
  status: 'paid';
  packageId?: string | null;
  payTime: Date;
}
