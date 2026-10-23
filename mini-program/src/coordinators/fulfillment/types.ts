export type AttendanceStatus = 'present' | 'leave' | 'absent' | 'late';
export type FulfillmentMode = 'FULL_SETTLE' | 'ATTENDANCE_ONLY' | 'PUBLISH_EVALUATION';
export type ReversalStrategy = 'FULL_ROLLBACK' | 'REOPEN_EVALUATION';

export interface StudentFulfillmentOverride {
  studentId: string;
  status?: AttendanceStatus;
  deductLessons?: number;
  rating?: number;
  personalizedComment?: string;
  performanceTag?: string;
  photos?: string[];
  videoUrl?: string;
  isEvaluated?: boolean;
}

export interface SessionStudentItem {
  studentId: string;
  studentNo: string;
  name: string;
  phone?: string;
  avatar?: string;
  status: AttendanceStatus;
  deductLessons: number;
  remainingLessons: number;
  rating: number;
  comment?: string;
  isAnomaly: boolean;
  isWechatBound?: boolean;
  isEvaluated?: boolean;
  isExempt?: boolean;
  evaluatedAt?: string;
  evaluatedSource?: string;
  photos?: string[];
  videoUrl?: string;
}

export interface SessionEvaluationDraft {
  templateId?: string;
  templateName: string;
  lessonTitle: string;
  studyContentHtml: string;
  overallRating: number;
  teacherComment: string;
  photoList: string[];
  videoUrl?: string;
  voiceUrl?: string;
  studentComments?: Record<string, { comment: string; rating?: number }>;
}

export interface ScheduleMetadata {
  id: string;
  campusId: string;
  classId: string;
  className: string;
  courseId: string;
  courseName: string;
  teacherId: string;
  teacherName: string;
  advisorName?: string;
  classroomId: string;
  classroomName: string;
  date: string;
  startTime: string;
  endTime: string;
  timeRange: string;
  status: string;
  expectedCount: number;
  actualCount: number;
  coursewareUrl?: string;
}

export interface FulfillmentReceipt {
  receiptId: string;
  scheduleEventId: string;
  mode: FulfillmentMode;
  completedAt: string;
  totalStudents: number;
  presentCount: number;
  leaveCount: number;
  absentCount: number;
  totalDeductedLessons: number;
  anomalyCount: number;
  evaluationId?: string;
  outboxCount: number;
}

export interface FulfillmentReversalReceipt {
  receiptId: string;
  scheduleEventId: string;
  strategy: ReversalStrategy;
  reversedAt: string;
  refundedLessons: number;
  cancelledOutboxCount: number;
}

export interface FulfillmentCommitOptions {
  mode?: FulfillmentMode;
  dispatchStrategy?: 'ATTENDED_ONLY' | 'ALL_ENROLLED' | 'NONE';
  idempotencyKey?: string;
}

export interface FulfillmentSession {
  readonly schedule: ScheduleMetadata;
  readonly students: SessionStudentItem[];
  readonly evaluation: SessionEvaluationDraft;
  readonly isDirty: boolean;
  readonly isCommitted: boolean;

  toggleStudentAttendance(studentId: string): void;
  setStudentStatus(studentId: string, status: AttendanceStatus, deductLessons?: number): void;
  batchMarkAttendance(status: AttendanceStatus): void;
  updatePersonalizedComment(studentId: string, comment: string, rating?: number): void;
  updateEvaluationDraft(patch: Partial<SessionEvaluationDraft>): void;
  saveDraft(): Promise<void>;
  commit(options?: FulfillmentCommitOptions): Promise<FulfillmentReceipt>;
}

export type FulfillmentWorkbenchSession = FulfillmentSession;

/** 单学员独立课评草稿模型 (含不可变基线封闭性凭证) */
export interface StudentEvaluationDraft {
  studentId: string;
  studentName: string;
  className: string;
  courseName: string;
  lessonTitle: string;
  templateId?: string;
  templateName: string;
  /** 课程学习内容与知识点大纲：课次级（全班共享），对应 LessonEvaluation.studyContent */
  studyContent: string;
  /** 随堂特写评语：该学员专属，对应 LessonEvaluationStudentItem.comment */
  comment: string;
  rating: number;
  photos: string[];
  videoUrl?: string;
  isModified?: boolean;
  isEvaluated?: boolean;
  /** 不可变基线快照凭证，用于差分计算与防篡改比对 */
  readonly _baselineToken: {
    baselineContent: string;
    baselineRating: number;
    studentId: string;
    scheduleId: string;
    hash?: string;
  };
}

export interface QuickFulfillOptions {
  idempotencyKey?: string;
  notifyParents?: boolean;
}

export interface DraftSaveOptions {
  immediate?: boolean;
  debounceMs?: number;
}

export interface ClientLessonFulfillmentCoordinator {
  // 1. 【90% 极速通途】全班一键全勤消课 + 自动课评生成 + 微信信箱出站
  quickFulfill(scheduleEventId: string, options?: QuickFulfillOptions): Promise<FulfillmentReceipt>;
  fulfill(scheduleEventId: string, options?: { idempotencyKey?: string }): Promise<FulfillmentReceipt>;

  // 2. 【单学员独立课评】水化、暂存与精准发布（彻底解耦全班状态，为 edit.vue 定制）
  hydrateStudentDraft(scheduleEventId: string, studentId: string): Promise<StudentEvaluationDraft>;
  saveStudentDraft(scheduleEventId: string, studentId: string, draft: Partial<StudentEvaluationDraft>, options?: DraftSaveOptions): Promise<void>;
  commitStudentEvaluation(scheduleEventId: string, studentId: string, draft: Partial<StudentEvaluationDraft>): Promise<FulfillmentReceipt>;

  // 3. 【整班交互式工作台】微调出勤、自定义评语与全员提交
  openWorkbench(scheduleEventId: string): Promise<FulfillmentWorkbenchSession>;
  loadSession(scheduleEventId: string): Promise<FulfillmentSession>;

  // 4. 【草稿保存兼容】
  saveDraft(scheduleEventId: string, draft: Partial<SessionEvaluationDraft>): Promise<void>;

  // 5. 【级联安全反结课】课时退还 + 课包自愈 + 微信在途通知原子作废
  reverse(scheduleEventId: string, reason: string, strategy?: ReversalStrategy): Promise<FulfillmentReversalReceipt>;
}

