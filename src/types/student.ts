// ==========================================
// 拓视未来教育「一校教培系统」学员中心与 CRM 数据契约
// 对应 PROJECT.md 与 MODULE_ANALYSIS_DESIGN.md
// ==========================================

export type StudentStatus = 'normal' | 'suspended' | 'transferred' | 'dropped_out';

export interface StudentCoursePackage {
  packageId: string;
  courseId: string;
  courseName: string;
  pricePerLesson?: number;
  totalLessons: number;
  remainingLessons: number;
  consumedLessons?: number;
  bonusLessons?: number;
  expireDate?: string;
  expiryDate?: string; // 兼容 expiryDate 与 expireDate
  status: 'active' | 'frozen' | 'refunded' | 'completed';
  classId?: string;
  className?: string;
  orderNo?: string;
  teacherName?: string;
}

export interface WalletLedgerItem {
  id: string;
  type: 'recharge' | 'consumption' | 'refund' | 'withdraw' | 'transfer' | 'bonus_grant';
  amount: number;
  principalChange: number;
  bonusChange: number;
  time: string;
  orderNo?: string;
  description: string;
  operator: string;
}

export interface StudentWallet {
  principalBalance: number;
  bonusBalance: number;
  goldPoints?: number; // 零花钱积分
  ledger?: WalletLedgerItem[];
}

export interface StudentRecord {
  id: string;
  date: string;
  lessonName: string;
  courseName: string;
  teacher: string;
  status: 'attended' | 'leave' | 'absent' | 'late';
  score: number; // 0-100
  comment: string;
  homeworkRating: 'A+' | 'A' | 'B+' | 'B' | 'C';
  artworkUrl?: string;
  quizScore?: number;
}

export interface CommunicationRecord {
  id: string;
  time: string;
  counselor: string;
  type: '电话跟进' | '课后反馈' | '请假回访' | '续费沟通' | '满意度调查';
  method: 'phone' | 'wechat' | 'in_person';
  content: string;
  duration?: string; // e.g. "03:25"
  audioUrl?: string; // 录音模拟
  nextFollowUpTime?: string;
  parentSatisfaction?: number; // 1-5 星级
}

export interface CompetitionRecord {
  id: string;
  competitionName: string;
  session: string;
  level: string;
  award: string;
  awardDate: string;
  certificateNo: string;
  certificateImage?: string;
  status: 'passed' | 'pending' | 'failed';
}

export interface ServiceFeeRecord {
  id: string;
  certNo: string;
  studentId: string;
  studentName: string;
  studentNo: string;
  campusId: string;
  campusName: string;
  examType: string;
  category: 'competition' | 'certification'; // 白名单赛事 或 考级
  fee: number;
  invoiceTitle?: string;
  yikuaibaoVoucherNo?: string;
  status: 'verified' | 'pending';
  createTime: string;
  verifyTime?: string;
  operator: string;
  voucherImage?: string;
}

export interface UnassignedStudentItem {
  id: string;
  studentId: string;
  name: string;
  studentNo: string;
  avatar?: string;
  gender: 'male' | 'female';
  phone: string;
  campusId: string;
  campusName: string;
  courseId: string;
  courseName: string;
  unassignedLessons: number;
  preferredTime: string;
  signupDate: string;
  counselor: string;
  assessmentScore?: number;
  assessmentSummary?: string;
}

export interface Student {
  id: string;
  name: string;
  studentNo: string;
  gender: 'male' | 'female';
  age?: number;
  phone: string;
  avatar?: string;
  campusId: string;
  campusName: string;
  grade: string;
  school?: string;
  publicSchool?: string;
  parentName?: string;
  parentPhone?: string;
  parentWechat?: string;
  boundWechat?: string;
  wechatBound?: boolean;
  faceEntered?: boolean;
  faceImageUrl?: string;
  status: StudentStatus;
  wallet: StudentWallet;
  coursePackages: StudentCoursePackage[];
  learningRecords?: StudentRecord[];
  communicationRecords?: CommunicationRecord[];
  competitionRecords?: CompetitionRecord[];
  createdAt: string;
  updatedAt?: string;
}

// 保持 StudentProfile 契约完全向后兼容
export type StudentProfile = Student;

// 7 大异动分支类型定义
export type MovementType =
  | 'transfer_class'
  | 'change_course'
  | 'suspend'
  | 'resume'
  | 'transfer_campus'
  | 'transfer_student'
  | 'refund';

export interface AbnormalMovementPayload {
  movementType: MovementType;
  studentId: string;
  reason?: string;
  operator?: string;
  // 1. 转班
  packageId?: string;
  fromClassId?: string;
  toClassId?: string;
  targetClassCapacity?: number;
  targetClassCurrentCount?: number;
  // 2. 换课
  newCourseId?: string;
  newPurchasedLessons?: number;
  // 3. 停课
  suspensionDays?: number;
  // 5. 转校
  targetCampusId?: string;
  authorizedCampusIds?: string[];
  // 6. 转让
  targetStudentId?: string;
  // 7. 退费
  deductionFee?: number;
}
