/**
 * 课消结算引擎领域核心类型与视图模型契约
 * 统一排课结课、随堂点名消课、反结课冲正与工作台看板聚合数据结构
 */

export type AttendanceStatus = 'present' | 'leave' | 'absent' | 'late';

export interface WorkbenchQuery {
  campusId?: string;
  date?: string;             // YYYY-MM-DD
  teacherId?: string;        // 讲师过滤 (数据权限绑定)
  classId?: string;
}

export interface WorkbenchMetrics {
  scheduledCount: number;    // 当日待上课次
  completedCount: number;    // 当日已结课次
  totalStudents: number;     // 当日应到学员总人次
  presentStudents: number;   // 当日实到学员总人次
  totalDeductedLessons: number; // 累计扣减课消学时
}

export interface ScheduleCardView {
  id: string;
  className: string;
  courseName: string;
  teacherId: string;
  teacherName: string;
  classroomId: string;
  classroomName: string;
  date: string;
  startTime: string;
  endTime: string;
  timeSlot: string;
  studentCount: number;
  signedCount: number;
  attendanceCount: number;
  status: string;
  semanticType: string;
  canRollCall: boolean;
  studentIds: string[];
  evaluationStatus?: string;
}

export interface AttendanceHistoryView {
  id: string;
  recordId: string;
  scheduleEventId: string;
  className: string;
  courseName: string;
  teacherName: string;
  classroomName: string;
  date: string;
  startTime: string;
  endTime: string;
  timeSlot: string;
  totalStudents: number;
  presentCount: number;
  leaveCount: number;
  absentCount: number;
  lateCount: number;
  deductedLessonsTotal: number;
  isReversed: boolean;
  reversalReason?: string;
  reversedAt?: string;
  reversedBy?: string;
  operator: string;
  createdAt: string;
  canRevert: boolean;
  items: Array<{
    id: string;
    studentId: string;
    studentName: string;
    studentNo: string;
    status: AttendanceStatus;
    deductLessons: number;
    packageId?: string | null;
    regularBurned: number;
    bonusBurned: number;
    score: number | null;
    rating: string | null;
    comment: string | null;
    isReversed: boolean;
  }>;
}

export interface WorkbenchSnapshot {
  campusId?: string;
  date: string;
  metrics: WorkbenchMetrics;
  schedules: ScheduleCardView[];
  history: AttendanceHistoryView[];
}

export interface RollCallStudentView {
  studentId: string;
  studentNo: string;
  name: string;
  studentName: string;
  phone: string;
  gender?: string;
  packageId: string;
  remainingLessons: number;
  bonusLessons: number;
  totalLessons: number;
  isLowBalance: boolean;     // 剩余课时 <= 3 自动预警
  attendanceStatus: AttendanceStatus;
  status: AttendanceStatus;
  isRecorded: boolean;
  score: number | null;
  rating: string | null;
  comment: string;
  remark: string;
  deductLessons: number;
  deductionLessons: number;
}

export interface RollCallSessionView {
  scheduleEventId: string;
  classId: string;
  className: string;
  courseId: string;
  courseName: string;
  teacherId: string;
  teacherName: string;
  classroomId: string;
  classroomName: string;
  date: string;
  startTime: string;
  endTime: string;
  timeSlot: string;
  status: string;
  canSettle: boolean;
  students: RollCallStudentView[];
  summary: {
    totalStudents: number;
    defaultPresentCount: number;
    estimatedDeductLessons: number;
  };
}

export interface RollCallSubmissionItem {
  studentId: string;
  status: AttendanceStatus;
  deductLessons?: number;
  packageId?: string;
  comment?: string;
  score?: number;
  rating?: string;
}

export interface RollCallSubmission {
  scheduleEventId: string;
  items: RollCallSubmissionItem[];
}

export interface SettlementReceipt {
  success: boolean;
  scheduleEventId: string;
  completedCount: number;
  totalDeductedLessons: number;
  regularLessonsBurned: number;
  bonusLessonsBurned: number;
  summary: {
    totalStudents: number;
    presentCount: number;
    leaveCount: number;
    absentCount: number;
    lateCount: number;
    totalLessonsDeducted: number;
  };
  details: Array<{
    studentId: string;
    packageId: string;
    deductLessons: number;
    regularBurned: number;
    bonusBurned: number;
    remainingAfter: number;
  }>;
  message: string;
}

export interface ReversalReceipt {
  success: boolean;
  scheduleEventId: string;
  reversedCount: number;
  refundedLessons: number;
  refundedRegularLessons: number;
  refundedBonusLessons: number;
  details: Array<{
    studentId: string;
    packageId: string;
    refundedLessons: number;
    remainingAfter: number;
  }>;
  message: string;
}
