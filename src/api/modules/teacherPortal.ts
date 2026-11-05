import { request } from '@/utils/request';

export type AttendanceStatus = 'present' | 'late' | 'leave' | 'absent';
export type LessonStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface TeacherOverview {
  today: string;
  todayLessonCount: number;
  todayPendingCount: number;
  overdueLessonCount: number;
  pendingEvaluationCount: number;
  warningCount: number;
}

export interface TeacherLessonItem {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: LessonStatus;
  classType: string;
  classId: string;
  className: string;
  courseName: string;
  classroomName: string;
  teacherName: string;
  expectedCount: number;
  actualCount: number;
  lessonNumber?: number;
  lessonTitle?: string;
}

export interface WorkbenchStudent {
  studentId: string;
  studentNo: string;
  studentName: string;
  phone: string;
  remainingLessons: number;
  isLowBalance: boolean;
  defaultStatus: AttendanceStatus;
  defaultDeductLessons: number;
  isRecorded: boolean;
  recordedStatus?: AttendanceStatus;
  isPublished?: boolean;
  hasPersonalEvaluation?: boolean;
  evaluatedAt?: string;
  photos?: string[];
  /** 与 photos 一一对应：列表缩略图 */
  photoThumbs?: string[];
  /** 与 photos 一一对应：大图预览 */
  photoPreviews?: string[];
  videoUrl?: string;
  videoPoster?: string;
  currentComment?: string;
  currentRating?: number;
}

export interface LessonWorkbench {
  schedule: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    classId: string;
    className: string;
    classroomName: string;
    courseName: string;
    teacherId: string;
    teacherName: string;
    status: LessonStatus;
    canSettle: boolean;
    expectedCount: number;
    actualCount: number;
  };
  evaluationDraft: {
    /** 为 false 时 studyContentHtml 只是教研模板文案，不是老师写的内容 */
    isExisting: boolean;
    evaluationStatus?: string;
    studyContentHtml: string;
    lastPublishedAt?: string;
  };
  students: WorkbenchStudent[];
}

export interface EvaluationRosterItem {
  scheduleId: string;
  studentId: string;
  studentName: string;
  studentNo: string;
  className: string;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  isPushed: boolean;
  rating: number | null;
}

export interface EvaluationRoster {
  startDate: string;
  endDate: string;
  items: EvaluationRosterItem[];
  metrics: { totalCount: number; pushedCount: number; pendingCount: number; coverageRate: number };
}

export interface TeacherClassItem {
  id: string;
  name: string;
  status: string;
  capacity: number;
  startDate: string;
  endDate: string | null;
  courseName: string;
  teacherName: string;
  classroomName: string;
  myRole: string;
  studentCount: number;
  completedLessons: number;
  totalLessons: number;
  nextLesson: { date: string; startTime: string } | null;
}

export interface TeacherClassDetail {
  id: string;
  name: string;
  status: string;
  capacity: number;
  startDate: string;
  endDate: string | null;
  courseName: string;
  teacherName: string;
  advisorName: string;
  classroomName: string;
  myRole: string;
  completedLessons: number;
  totalLessons: number;
  schedules: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: LessonStatus;
    teacherName: string;
    classroomName: string;
    attendedCount: number;
    recordedCount: number;
    canOperate: boolean;
  }>;
  students: Array<{
    id: string;
    name: string;
    studentNo: string;
    phone: string;
    parentName: string | null;
    remainingLessons: number;
    totalLessons: number;
  }>;
}

export interface TeacherStudentItem {
  id: string;
  name: string;
  studentNo: string;
  gender: string;
  phone: string;
  parentName: string | null;
  status: string;
  remainingLessons: number;
  isLowLessons: boolean;
  classes: Array<{ id: string; name: string }>;
}

export interface TeacherStudentDetail {
  id: string;
  name: string;
  studentNo: string;
  gender: string;
  phone: string;
  parentName: string | null;
  status: string;
  birthday: string | null;
  school: string | null;
  courses: Array<{
    id: string;
    status: string;
    courseName: string;
    classId: string | null;
    className: string;
    totalLessons: number;
    remainingLessons: number;
    consumedLessons: number;
  }>;
  attendances: Array<{
    id: string;
    scheduleId: string;
    status: AttendanceStatus;
    deductLessons: number;
    date: string;
    startTime: string;
    endTime: string;
    className: string;
    isEvaluated: boolean;
  }>;
}

export type WarningType = 'low_lessons' | 'absence' | 'inactive';

export interface TeacherWarningItem {
  id: string;
  type: WarningType;
  level: 'urgent' | 'warning';
  reason: string;
  studentId: string;
  studentName: string;
  studentNo: string;
  phone: string;
  parentName: string | null;
  classNames: string[];
  remainingLessons: number;
}

export interface TeacherWarnings {
  items: TeacherWarningItem[];
  summary: { total: number; low_lessons: number; absence: number; inactive: number };
}

function toLessonItem(raw: any): TeacherLessonItem {
  return {
    id: raw.id,
    date: raw.date,
    startTime: raw.startTime,
    endTime: raw.endTime,
    status: raw.status,
    classType: raw.classType,
    classId: raw.classId,
    className: raw.class?.name || '',
    courseName: raw.class?.course?.name || '',
    classroomName: raw.classroom?.name || '',
    teacherName: raw.teacher?.realName || '',
    expectedCount: raw.expectedCount ?? 0,
    actualCount: raw.actualCount ?? 0,
    lessonNumber: raw.lessonNumber,
    lessonTitle: raw.lessonTitle,
  };
}

export const teacherPortalApi = {
  getOverview: () => request<TeacherOverview>('/api/teacher-portal/overview'),

  getEvaluations: (params: { startDate?: string; endDate?: string; status?: string; keyword?: string }) =>
    request<EvaluationRoster>('/api/teacher-portal/evaluations', { params }),

  getClasses: (params?: { keyword?: string }) =>
    request<TeacherClassItem[]>('/api/teacher-portal/classes', { params }),

  getClassDetail: (id: string) => request<TeacherClassDetail>(`/api/teacher-portal/classes/${id}`),

  getStudents: (params: { keyword?: string; page?: number; pageSize?: number }) =>
    request<{ total: number; page: number; pageSize: number; list: TeacherStudentItem[] }>(
      '/api/teacher-portal/students',
      { params },
    ),

  getStudentDetail: (id: string) => request<TeacherStudentDetail>(`/api/teacher-portal/students/${id}`),

  getWarnings: () => request<TeacherWarnings>('/api/teacher-portal/warnings'),

  /** 本人课次：显式传 teacherId，校区级数据权限的老师也只看自己的课 */
  getMyLessons: async (params: { teacherId: string; startDate: string; endDate: string }) => {
    const res = await request<any[]>('/api/educational/schedules', { params });
    return (res.data || []).filter((s) => s.status !== 'cancelled').map(toLessonItem);
  },

  getLessonWorkbench: (scheduleId: string) =>
    request<LessonWorkbench>(`/api/educational/fulfillment/workbench/${scheduleId}`),

  /** 只同步出勤与课耗，不带任何课评内容，不会发布也不会通知家长 */
  syncAttendance: (
    scheduleEventId: string,
    students: Array<{ studentId: string; attendanceStatus: AttendanceStatus; deductLessons: number }>,
  ) =>
    request('/api/educational/lesson-evaluations/commit', {
      method: 'POST',
      // 切到后台 / 关闭页面时这个请求也要能发完
      keepalive: true,
      body: JSON.stringify({ scheduleEventId, publish: false, payload: { studentOverrides: students } }),
    }),

  /** 结课消课：扣减课时并把课次置为已结课，不生成课评，也不通知家长 */
  settleLesson: (
    scheduleEventId: string,
    students: Array<{ studentId: string; status: AttendanceStatus; deductLessons: number }>,
  ) =>
    request('/api/educational/fulfillment/fulfill', {
      method: 'POST',
      body: JSON.stringify({
        scheduleEventId,
        mode: 'ATTENDANCE_ONLY',
        anomalyOverrides: students,
        idempotencyKey: `web-teacher-settle-${scheduleEventId}-${Date.now()}`,
      }),
    }),

  /** 发布单个学员的课评并通知该学员家长，不影响同班其他学员 */
  publishStudentEvaluation: (data: {
    scheduleEventId: string;
    studentId: string;
    status: AttendanceStatus;
    deductLessons: number;
    comment: string;
    rating: number;
    photos: string[];
    videoUrl: string;
    /** 仅在老师写了 / 改了大纲时传，否则保留课次已有内容 */
    studyContent?: string;
    lessonTitle: string;
  }) =>
    request('/api/educational/fulfillment/fulfill', {
      method: 'POST',
      body: JSON.stringify({
        scheduleEventId: data.scheduleEventId,
        mode: 'PUBLISH_EVALUATION',
        targetStudentId: data.studentId,
        lessonTitle: data.lessonTitle,
        // 只在该课次首次发布时生效：不传则服务端写入教研模板评语，且不能写入某个学员的专属评语
        teacherComment: '老师已完成本节课的课堂点评',
        ...(data.studyContent ? { studyContentHtml: data.studyContent } : {}),
        photoList: [],
        overallRating: data.rating,
        anomalyOverrides: [
          {
            studentId: data.studentId,
            status: data.status,
            deductLessons: data.deductLessons,
            personalizedComment: data.comment,
            rating: data.rating,
            photos: data.photos,
            videoUrl: data.videoUrl,
            isEvaluated: true,
          },
        ],
        source: 'web-teacher',
        idempotencyKey: `web-teacher-eval-${data.scheduleEventId}-${data.studentId}-${Date.now()}`,
      }),
    }),
};
