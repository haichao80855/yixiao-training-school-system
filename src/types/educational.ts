// ==========================================
// 拓视未来教育「一校教培系统」教务与排课矩阵核心类型契约
// 对应 PROJECT.md 与 MODULE_ANALYSIS_DESIGN.md
// ==========================================

export type ScheduleSemanticType = 'completed' | 'conflict' | 'personal' | 'regular';
export type LessonClassType = 'formal' | 'make_up' | 'trial';
export type ScheduleEventStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type ClassStatus = 'recruiting' | 'in_progress' | 'completed' | 'cancelled' | 'archived';
export type AttendanceStatus = 'present' | 'leave' | 'absent' | 'late';

// 教室属性
export interface Classroom {
  id: string;
  name: string;
  code: string;
  campusId: string;
  campusName?: string;
  capacity: number; // 容纳人数
  type: string; // 'maker' | 'computer' | 'regular' | 'vip'
  typeName?: string; // '乐博创客实验室' | '信息学编程机房' | '多媒体大班教室' | 'VIP名师辅导室'
  status: 'available' | 'maintenance' | 'disabled';
}

// 讲师/教务人员属性
export interface Teacher {
  id: string;
  name: string;
  campusId: string;
  campusName?: string;
  phone: string;
  role: 'teacher' | 'advisor' | 'head_teacher' | 'assistant';
  roleName?: string;
  subjects: string[];
  avatar?: string;
  maxWeeklyHours?: number;
  currentWeeklyHours?: number;
}

// 班级基础属性
export interface ClassItem {
  id: string;
  code: string;
  name: string;
  campusId: string;
  campusName?: string;
  courseId: string;
  courseName: string;
  teacherId: string;
  teacherName: string;
  assistantId?: string;
  assistantName?: string;
  classroomId: string;
  classroomName: string;
  capacity: number;
  currentStudentCount: number;
  studentIds: string[];
  startDate: string;
  endDate: string;
  status: ClassStatus;
  scheduleDesc?: string; // 如 "每周六 09:00-10:30"
  completedLessons?: number;
  totalLessons?: number;
  createdAt?: string;
  updatedAt?: string;
}

// 排课课次日程事件
export interface ScheduleEvent {
  id: string;
  classId?: string;
  className: string;
  courseId: string;
  courseName: string;
  campusId: string;
  campusName?: string;
  teacherId: string;
  teacherName: string;
  assistantId?: string;
  assistantName?: string;
  classroomId: string;
  classroomName: string;
  date: string; // '2026-09-26'
  startTime: string; // '09:00'
  endTime: string; // '10:30'
  durationMinutes?: number; // 90
  studentIds: string[];
  isPersonal?: boolean;
  hasConflict?: boolean;
  conflictType?: 'TEACHER_CONFLICT' | 'CLASSROOM_CONFLICT' | 'STUDENT_CONFLICT' | 'TIME_WINDOW_VIOLATION' | 'CLASSROOM_CAPACITY_EXCEEDED' | string;
  conflictReason?: string;
  status?: ScheduleEventStatus;
  lessonNumber?: number; // 第几讲/课次
  lessonTitle?: string;
  semanticType: ScheduleSemanticType;
  classType: LessonClassType;
  attendanceCount?: number;
  totalCount?: number;
  isFinished?: boolean;
  type?: string;
  excludeEventId?: string;
}

// 学员考勤明细条目
export interface StudentAttendanceItem {
  studentId: string;
  studentName: string;
  studentNo?: string;
  status: AttendanceStatus;
  deductionLessons: number;
  pricePerLesson?: number;
  actualDeductAmount?: number;
  packageId?: string;
  isLowBalance?: boolean;
  remark?: string;
  remainingLessonsBefore?: number;
  remainingLessonsAfter?: number;
}

// 考勤点名课消记录与反结课属性
export interface AttendanceRecord {
  id: string;
  scheduleEventId: string;
  classId: string;
  className: string;
  courseId?: string;
  courseName?: string;
  campusId: string;
  campusName?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  lessonNumber: number;
  lessonTitle?: string;
  teacherId: string;
  teacherName: string;
  studentAttendances: StudentAttendanceItem[];
  totalStudents: number;
  presentCount: number;
  leaveCount: number;
  absentCount: number;
  lateCount: number;
  deductedLessonsTotal: number;
  isReversed: boolean;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  createdAt: string;
  operator?: string;
}

// 三维冲突检测结构
export type ConflictType =
  | 'TEACHER_CONFLICT'
  | 'CLASSROOM_CONFLICT'
  | 'STUDENT_CONFLICT'
  | 'TIME_WINDOW_VIOLATION'
  | 'CLASSROOM_CAPACITY_EXCEEDED';

export interface ConflictItem {
  type: ConflictType | string;
  eventId?: string;
  teacherId?: string;
  classroomId?: string;
  studentIds?: string[];
  reason: string;
}

export interface CollisionResult {
  hasConflict: boolean;
  conflictType?: string;
  reason?: string | null;
  conflicts: ConflictItem[];
  teacherConflict?: boolean;
  classroomConflict?: boolean;
  studentConflicts?: string[];
  conflictingEvents?: ScheduleEvent[];
  message?: string;
}

export interface ScheduleCollisionParams {
  date: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  classroomId: string;
  studentIds: string[];
  excludeEventId?: string;
}

// Lane 分配位置信息的日程卡片计算类型
export interface LaneStyle {
  top: string;
  height: string;
  width: string;
  left: string;
  [key: string]: any;
}

export interface LaneEvent {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  laneIndex: number;
  totalLanes: number;
  style: LaneStyle;
  event: ScheduleEvent;
}

// ==========================================
// 讲台与深度课评系统契约
// ==========================================

export interface EvaluationTemplate {
  id: string;
  name: string;
  category: string;
  defaultStudyContent: string;
  defaultTeacherComment: string;
  tags?: string[];
}

export interface StudentEvaluationItem {
  studentId: string;
  studentName: string;
  rating: number;
  comment: string;
  performanceTag?: string;
  avatar?: string;
}

export interface LessonEvaluation {
  id: string;
  lessonTimeId: string;              // 对应排课日程 ScheduleEvent.id
  classId: string;
  className: string;
  lessonTitle: string;
  templateId?: string;
  templateName?: string;
  studyContent: string;              // 富文本学习内容
  rating: number;                    // 综合评价 1-5 星
  voiceUrl?: string;                 // 语音点评录音
  voiceDuration?: number;            // 语音时长秒数
  videoUrl?: string;                 // 课堂视频
  photoList: string[];               // 课堂相册，最多 9 张
  teacherComment: string;            // 老师点评正文
  aiPolished?: boolean;              // 是否经过 AI 润色
  status: 'draft' | 'published';     // 暂存草稿 | 已发送家长端
  publishTime?: string;              // 推送时间
  studentEvaluations?: Record<string, StudentEvaluationItem>; // 学员个性化特写
  updatedAt: string;
}

export interface WorkbenchLessonCard extends ScheduleEvent {
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  mode: 'offline' | 'online' | 'dual_teacher';
  totalStudents: number;
  signedCount: number;
  teachingAssistants: string[];
  evaluationStatus?: 'none' | 'draft' | 'published';
  playbackUrl?: string;
}

// ----------------------------------------------------------------------------
// 班级花名册与分班履约调度类型契约 (Class Roster Coordinator)
// ----------------------------------------------------------------------------

export interface StudentAssignItemResult {
  studentId: string;
  studentName: string;
  studentNo: string;
  packageId: string;
  previousClassId: string | null;
  status: 'assigned' | 'transferred' | 'idempotent_noop';
}

export interface AssignStudentsResult {
  success: boolean;
  classId: string;
  className: string;
  assignedCount: number;
  currentStudentCount: number;
  capacity: number;
  remainingCapacity: number;
  isFull: boolean;
  dryRun: boolean;
  students: StudentAssignItemResult[];
  message: string;
}

export interface RemoveStudentResult {
  success: boolean;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  packageId: string;
  unassignedLessons: number;
  newClassStudentCount: number;
  studentStatus: 'normal' | 'in_class';
  fallbackToUnassignedPool: true;
  message: string;
}

export interface UnassignedStudentItemView {
  id: string;
  studentId: string;
  name: string;
  studentNo: string;
  avatar: string;
  gender: string;
  phone: string;
  campusId: string;
  campusName: string;
  courseId: string;
  courseName: string;
  packageId: string;
  unassignedLessons: number;
  preferredTime: string;
  signupDate: string;
  waitDays: number;
  counselor: string;
  assessmentScore: number;
  assessmentSummary: string;
}

export interface UnassignedRosterSummary {
  totalStudents: number;
  totalUnassignedLessons: number;
  monthlyNewCount: number;
  avgWaitDays: number;
}

export interface UnassignedRosterResult {
  total: number;
  page: number;
  pageSize: number;
  summary: UnassignedRosterSummary;
  list: UnassignedStudentItemView[];
}

export interface ClassRosterStudentView {
  studentId: string;
  packageId: string;
  name: string;
  studentNo: string;
  phone: string;
  avatar: string;
  remainingLessons: number;
  consumedLessons: number;
  bonusLessons: number;
  isLessonDeficit: boolean;
  joinDate: string;
  status: string;
}

export interface ClassRosterResult {
  classId: string;
  className: string;
  classCode: string;
  courseId: string;
  courseName: string;
  teacherName: string;
  classroomName: string;
  capacity: number;
  currentStudentCount: number;
  occupancyRate: number;
  isFull: boolean;
  availableCapacity: number;
  students: ClassRosterStudentView[];
}

// ----------------------------------------------------------------------------
// 班级全生命周期协调器 (Class Lifecycle Coordinator) 契约
// ----------------------------------------------------------------------------
export type LifecycleActionType = 'activate' | 'complete' | 'cancel' | 'merge';

export type StudentDispositionPolicy =
  | { mode: 'fallback_unassigned' }
  | { mode: 'transfer_next_class'; targetClassId: string }
  | { mode: 'archive_completed' };

export interface ActivateClassCommand {
  classId: string;
  actualStartDate?: string;
  minStudentCount?: number;
}

export interface CompleteClassCommand {
  classId: string;
  disposition: StudentDispositionPolicy;
  cancelFutureSchedules?: boolean;
  remark?: string;
}

export interface CancelClassCommand {
  classId: string;
  reason: string;
}

export interface MergeClassesCommand {
  sourceClassIds: string[];
  targetClassId: string;
  sourceDisposition?: 'complete' | 'keep_empty';
  reason?: string;
}

export interface LifecycleCheckIssue {
  code: string;
  severity: 'blocking' | 'warning' | 'info';
  message: string;
}

export interface ClassLifecyclePreview {
  allowed: boolean;
  classId: string;
  className: string;
  action: LifecycleActionType;
  currentStatus: ClassStatus;
  targetStatus: ClassStatus;
  issues: LifecycleCheckIssue[];
  impact: {
    affectedStudentCount: number;
    affectedPackageCount: number;
    cancelledScheduleCount: number;
    auditedHistoricalAttendanceCount: number;
    freedClassroomSlots: number;
    targetClassRemainingCapacityBefore?: number;
    targetClassRemainingCapacityAfter?: number;
  };
  summary: string;
}

export interface ClassLifecycleReceipt {
  receiptId: string;
  classId: string;
  className: string;
  previousStatus: ClassStatus;
  currentStatus: ClassStatus;
  disposedStudentCount?: number;
  disbandedStudentCount?: number;
  migratedStudentCount?: number;
  cancelledScheduleCount?: number;
  revokedScheduleCount?: number;
  preservedAttendanceCount?: number;
  immutableFingerprint?: string;
  message: string;
}


