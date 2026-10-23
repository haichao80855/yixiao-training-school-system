// ==========================================
// 拓视未来教育「一校教培系统」学员中心与 CRM 数据契约
// 对应 PROJECT.md 与 MODULE_ANALYSIS_DESIGN.md
// ==========================================

// in_class：已编入班级在读 (后端报名入班 / 分班时写入)，与 normal 一样属于「正常在读」
export type StudentStatus = 'normal' | 'in_class' | 'suspended' | 'transferred' | 'dropped_out';

export interface StudentCoursePackage {
  id?: string;
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
  className?: string;
  teacher: string;
  classroomName?: string;
  status: 'attended' | 'leave' | 'absent' | 'late';
  score: number; // 0-100
  rating?: string; // A+ | A | B+ | B
  comment: string;
  homeworkRating: 'A+' | 'A' | 'B+' | 'B' | 'C' | string;
  artworkUrl?: string;
  quizScore?: number;
  deductLessons?: number;
  isReversed?: boolean;
  reversalReason?: string;
  reversedAt?: string;

  // 多媒体课评相册流扩展
  lessonTitle?: string;
  photoList?: string[];
  photos?: Array<{
    id: string;
    index: number;
    thumbnailUrl: string;
    fullUrl: string;
    previewList: string[];
    aspectRatio?: string;
  }>;
  videoUrl?: string;
  videoMeta?: { videoUrl: string; posterUrl: string };
  voiceUrl?: string;
  voiceMeta?: { audioUrl: string; durationSeconds: number; durationFormatted: string; waveformPeaks: number[] };
  studyContent?: string;
  studyContentHtml?: string;
  performanceTag?: string;
  shareToken?: string;
}

export interface CompetencyRadar {
  logic: number;
  creativity: number;
  focus: number;
  handsOn: number;
  expression: number;
  averageScore: number;
}

export interface StudentConsumptionHealth {
  /** 是否已报读；false 时不做消课预警与续费判断 */
  enrolled?: boolean;
  weeklyBurnRate: number;
  dailyBurnRate?: number;
  /** null = 无法预估（近 30 天无消课 / 无剩余课时 / 未报读） */
  estimatedDepletionDays: number | null;
  estimatedDepletionDate?: string | null;
  warningLevel: 'normal' | 'warning' | 'urgent' | 'critical';
  visualBadge?: {
    text: string;
    type: 'danger' | 'warning' | 'success';
    color: string;
  };
  dormantRisk: boolean | 'active' | 'mild_dormant' | 'deep_dormant';
  renewalWindowOpen: boolean;
  inactiveDays?: number;
  lastAttendanceDate?: string | null;
  futureScheduledLessons?: number;
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
  /** 名下是否有未全额退费的课包；false 时档案正常也展示为「未报读」 */
  isEnrolled?: boolean;
  wallet: StudentWallet;
  coursePackages: StudentCoursePackage[];
  totalRemainingLessons?: number;
  totalConsumedLessons?: number;
  warningLevel?: 'urgent' | 'warning' | 'normal' | 'critical' | string;
  riskLevel?: 'critical' | 'warning' | 'normal';
  learningRecords?: StudentRecord[];
  growthRadar?: CompetencyRadar;
  consumptionHealth?: StudentConsumptionHealth;
  communicationRecords?: CommunicationRecord[];
  competitionRecords?: CompetitionRecord[];
  albumGallery?: Array<{
    photoUrl: string;
    thumbnailUrl: string;
    date: string;
    courseName: string;
    lessonTitle: string;
    teacherName: string;
  }>;
  portfolioShareToken?: string;
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

// ==========================================
// 课消风控与续费决策协调器契约 (LessonRenewalCoordinator)
// ==========================================

export type RenewalWarningLevel = 'critical' | 'warning' | 'normal';
export type RenewalDormantRisk = 'active' | 'mild_dormant' | 'deep_dormant';
export type RenewalAdvice =
  | 'URGENT_RENEWAL'
  | 'DORMANT_FOLLOWUP'
  | 'WINDOW_OPEN'
  | 'HEALTHY_LEARNING'
  | 'BLOCKED_REFUNDING';

export interface StudentRiskDiagnosis {
  studentId: string;
  studentNo: string;
  studentName: string;
  phone: string;
  campusId: string;
  campusName: string;
  currentStatus: string;
  assetSummary: {
    totalRemainingLessons: number;
    totalConsumedLessons: number;
    activePackageCount: number;
    principalBalance: number;
    bonusBalance: number;
  };
  consumptionHealth: {
    weeklyBurnRate: number;
    dailyBurnRate: number;
    estimatedDepletionDays: number;
    estimatedDepletionDate: string | null;
    warningLevel: RenewalWarningLevel;
    visualBadge: {
      text: string;
      type: 'danger' | 'warning' | 'success';
      color: string;
    };
    lastAttendanceDate: string | null;
    inactiveDays: number;
    dormantRisk: RenewalDormantRisk;
    futureScheduledLessons: number;
  };
  decision: {
    renewalWindowOpen: boolean;
    advice: RenewalAdvice;
    targetPackageId: string | null;
    targetCourseId: string | null;
    targetCourseName: string | null;
    isRefundLocked: boolean;
    blockingReason?: string;
  };
}

export interface RenewalRosterQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  classId?: string;
  warningLevel?: RenewalWarningLevel | 'dormant' | 'all';
  riskLevel?: 'all' | 'critical' | 'warning' | 'normal' | 'dormant';
  dormantOnly?: boolean;
  renewalWindowOnly?: boolean;
  sortBy?: 'depletion_days' | 'remaining_lessons' | 'inactive_days' | 'risk' | 'urgency' | 'remaining';
  sortOrder?: 'asc' | 'desc';
}

export interface CampusRenewalRosterResult {
  total: number;
  page: number;
  pageSize: number;
  statistics: {
    criticalCount: number;
    warningCount: number;
    normalCount: number;
    dormantCount: number;
    windowOpenCount: number;
  };
  list: StudentRiskDiagnosis[];
}

export interface ClassRosterStudentHealth {
  studentId: string;
  studentNo: string;
  name: string;
  phone: string;
  packageId: string;
  courseName: string;
  totalLessons: number;
  remainingLessons: number;
  consumedLessons: number;
  warningLevel: RenewalWarningLevel;
  visualBadge: {
    text: string;
    type: 'danger' | 'warning' | 'success';
    color: string;
  };
  lastAttendanceDate: string | null;
  inactiveDays: number;
  isDormant: boolean;
  canQuickRenew: boolean;
}

export interface ClassRosterHealthReport {
  classId: string;
  className: string;
  courseId: string;
  courseName: string;
  teacherName: string;
  capacity: number;
  currentStudentCount: number;
  classHealthIndex: number;
  statistics: {
    criticalCount: number;
    warningCount: number;
    normalCount: number;
    dormantCount: number;
  };
  roster: ClassRosterStudentHealth[];
}

export interface RenewalDraftOptions {
  packageId?: string;
  preferredPackageId?: string;
  targetCourseId?: string;
  targetClassId?: string;
  customLessons?: number;
  recommendedLessons?: number;
  paymentMethod?: string;
  customDiscount?: number;
  operatorId?: string;
}

export interface RenewalOrderDraft {
  draftId: string;
  studentId: string;
  studentName: string;
  studentNo: string;
  campusId: string;
  campusName: string;
  createdAt: string;
  quote: {
    courseId: string;
    courseName: string;
    classId: string | null;
    className: string | null;
    totalLessons: number;
    bonusLessons: number;
    pricePerLesson: number;
    originalTotalPrice: number;
    suggestedDiscount: number;
    walletPrincipalBalance: number;
    canUseWalletDeduction: boolean;
    actualPayAmount: number;
    paymentMethod: string;
    remark: string;
  };
  validation: {
    pass: boolean;
    isClassFull: boolean;
    isRefundLocked: boolean;
    warningMessage?: string;
  };
  enrollCommand: {
    studentId: string;
    courseId: string;
    classId?: string;
    totalLessons: number;
    bonusLessons: number;
    pricePerLesson: number;
    discountAmount: number;
    couponAmount: number;
    paymentMethod: string;
    channel: string;
    ownerId?: string;
    remark?: string;
  };
}
