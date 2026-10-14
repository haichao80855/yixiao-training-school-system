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
  walletPaid: boolean;
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
