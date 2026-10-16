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

export interface ClientLessonFulfillmentCoordinator {
  fulfill(scheduleEventId: string, options?: { idempotencyKey?: string }): Promise<FulfillmentReceipt>;
  loadSession(scheduleEventId: string): Promise<FulfillmentSession>;
  saveDraft(scheduleEventId: string, draft: Partial<SessionEvaluationDraft>): Promise<void>;
  reverse(scheduleEventId: string, reason: string, strategy?: ReversalStrategy): Promise<FulfillmentReversalReceipt>;
}
