import { request } from '@/utils/request';
import {
  normalizeClass,
  normalizeSchedule,
  normalizeClassroom,
  normalizeAttendanceRecord,
  normalizeTeacher,
  normalizeWorkbenchLessonCard,
  normalizeRollCallStudent,
  normalizeCollisionResult
} from '../normalizers/educational';
import { normalizeStudent } from '../normalizers/student';

export function adaptRollCallDto(input: any): { scheduleEventId: string; items: any[] } {
  const scheduleEventId = input.scheduleEventId || input.scheduleId || '';
  const rawList = input.items || input.attendances || [];

  const items = rawList.map((item: any) => {
    const rawLessons = item.deductLessons ?? item.deductionLessons;
    const deductLessons = rawLessons !== undefined ? Number(rawLessons) : 1;
    const comment = item.comment || item.remark || undefined;

    return {
      studentId: item.studentId,
      packageId: item.packageId || undefined,
      status: item.status || 'present',
      deductLessons,
      ...(comment ? { comment } : {}),
      ...(item.score !== undefined ? { score: Number(item.score) } : {}),
      ...(item.rating ? { rating: item.rating } : {}),
    };
  });

  return {
    scheduleEventId,
    items,
  };
}

export const educationalApi = {
  // 教室管理
  getClassrooms: async (campusId?: string, fallbackData?: any) => {
    const res = await request('/api/educational/classrooms', { params: { campusId }, fallbackData });
    if (res && res.data && Array.isArray(res.data)) {
      res.data = res.data.map(normalizeClassroom) as any;
    }
    return res;
  },

  createClassroom: (data: any) =>
    request('/api/educational/classrooms', { method: 'POST', body: JSON.stringify(data) }),

  updateClassroom: (id: string, data: any) =>
    request(`/api/educational/classrooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteClassroom: (id: string) =>
    request(`/api/educational/classrooms/${id}`, { method: 'DELETE' }),

  // 班级管理
  getClasses: async (params?: any, fallbackData?: any) => {
    const res = await request('/api/educational/classes', { params, fallbackData });
    if (res && res.data) {
      if (Array.isArray(res.data)) {
        res.data = res.data.map(normalizeClass) as any;
      } else if (Array.isArray(res.data.list)) {
        res.data.list = res.data.list.map(normalizeClass);
      }
    }
    return res;
  },

  getAvailableClasses: async (params?: any, fallbackData?: any) => {
    const res = await request('/api/educational/classes', { params, fallbackData });
    if (res && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.list || []);
      return { success: true, data: list.map(normalizeClass) };
    }
    return res;
  },

  getClassById: async (id: string, fallbackData?: any) => {
    const res = await request(`/api/educational/classes/${id}`, { fallbackData });
    if (res && res.data) {
      res.data = normalizeClass(res.data);
    }
    return res;
  },

  getClass: async (id: string, fallbackData?: any) => {
    return educationalApi.getClassById(id, fallbackData);
  },

  createClass: (data: any) =>
    request('/api/educational/classes', { method: 'POST', body: JSON.stringify(data) }),

  updateClass: (id: string, data: any) =>
    request(`/api/educational/classes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteClass: (id: string) =>
    request(`/api/educational/classes/${id}`, { method: 'DELETE' }),

  assignStudentsToClass: async (classId: string, studentIds: string[] | string) => {
    const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
    return request('/api/educational/roster/assign', {
      method: 'POST',
      body: JSON.stringify({ classId, studentIds: ids }),
    });
  },

  // 班级花名册与分班履约调度深模块接缝 (Class Roster Coordinator)
  assignStudents: (data: { classId: string; studentIds: string[]; packageIds?: string[]; dryRun?: boolean }) =>
    request('/api/educational/roster/assign', { method: 'POST', body: JSON.stringify(data) }),

  previewAssignStudents: (data: { classId: string; studentIds: string[]; packageIds?: string[] }) =>
    request('/api/educational/roster/preview', { method: 'POST', body: JSON.stringify(data) }),

  removeStudent: (data: { classId: string; studentId: string; reason?: string }) =>
    request('/api/educational/roster/remove', { method: 'POST', body: JSON.stringify(data) }),

  getUnassignedRoster: (params?: { campusId?: string; courseId?: string; keyword?: string; page?: number; pageSize?: number }) =>
    request('/api/educational/roster/unassigned', { params }),

  getClassRoster: (classId: string) =>
    request(`/api/educational/roster/class/${classId}`),

  // 班级花名册学员消课健康度与续费预警 (LessonRenewalCoordinator)
  getClassRosterHealth: (classId: string, fallbackData?: any) =>
    request(`/api/educational/classes/${classId}/roster-health`, { fallbackData }),


  // 排课与日程管理
  getSchedules: async (params?: any, fallbackData?: any) => {
    const res = await request('/api/educational/schedules', { params, fallbackData });
    if (res && res.data && Array.isArray(res.data)) {
      res.data = res.data.map(normalizeSchedule) as any;
    }
    return res;
  },

  getScheduleEvents: async (params?: any, fallbackData?: any) => {
    return educationalApi.getSchedules(params, fallbackData);
  },

  createSchedule: (data: any) =>
    request('/api/educational/schedules', { method: 'POST', body: JSON.stringify(data) }),

  updateSchedule: (id: string, data: any) =>
    request(`/api/educational/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  updateScheduleStatus: (id: string, status: string) =>
    request(`/api/educational/schedules/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),

  deleteSchedule: (id: string) =>
    request(`/api/educational/schedules/${id}`, { method: 'DELETE' }),

  checkCollision: async (data: any, fallbackData?: any) => {
    const res = await request('/api/educational/schedules/check-collision', {
      method: 'POST',
      body: JSON.stringify(data),
      fallbackData,
    });
    if (res && res.data) {
      res.data = normalizeCollisionResult(res.data) as any;
    } else if (res && ((res as any).hasConflict !== undefined || (res as any).conflicts)) {
      return { success: true, data: normalizeCollisionResult(res) };
    }
    return res;
  },

  previewSchedules: (data: any) =>
    request<any>('/api/educational/schedules/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  commitBatchSchedules: (data: any) =>
    request<any>('/api/educational/schedules/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 点名考勤与反结课
  getRollCallStudents: async (scheduleId: string, fallbackData?: any) => {
    const res = await request(`/api/educational/schedules/${scheduleId}/roll-call-students`, { fallbackData });
    if (res && res.data && Array.isArray(res.data)) {
      res.data = res.data.map((item: any) => normalizeRollCallStudent(item)) as any;
    }
    return res;
  },

  rollCall: (data: any) => {
    const dto = adaptRollCallDto(data);
    return request('/api/educational/attendances/roll-call', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  reverseSchedule: (scheduleId: string, reason?: string) =>
    request(`/api/educational/schedules/${scheduleId}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // 授课工作台就绪快照与看板聚合 (一站式获取指标、待上课次与历史冲正流水)
  getWorkbenchSnapshot: async (params?: { campusId?: string; date?: string; classId?: string }, fallbackData?: any) => {
    return request('/api/educational/settlement/workbench', {
      params,
      fallbackData,
    });
  },

  getAttendanceRecords: async (params?: any, fallbackData?: any) => {
    const res = await request('/api/educational/attendances', { params, fallbackData });
    if (res && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.list || []);
      return { ...res, data: list.map(normalizeAttendanceRecord) };
    }
    return res;
  },

  // 讲师与教务人员列表 (教务业务专属端点)
  getTeachers: async (campusId?: string, fallbackData?: any) => {
    const res = await request('/api/educational/teachers', {
      params: { campusId: campusId && campusId !== 'all' ? campusId : undefined },
      fallbackData,
    });
    if (res && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.list || []);
      const teachers = list.filter((u: any) => {
        const role = u.roleName || u.postName || '';
        return role.includes('讲师') || role.includes('教师') || role.includes('学管') || role.includes('班主任') || u.roleId === 'r3' || u.role === 'teacher';
      }).map(normalizeTeacher);
      return { success: true, data: teachers.length > 0 ? teachers : list.map(normalizeTeacher) };
    }
    return res;
  },

  // 教学工作台授课聚合
  getWorkbenchLessons: async (params?: any, fallbackData?: any) => {
    const res = await educationalApi.getSchedules(params, fallbackData);
    let cards: any[] = [];
    if (res && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.items || res.data.list || []);
      cards = list.map(normalizeWorkbenchLessonCard);
    }

    if (params?.status) {
      cards = cards.filter((c) => c.status === params.status);
    }
    if (params?.mode) {
      cards = cards.filter((c) => c.mode === params.mode);
    }
    if (params?.search) {
      const q = String(params.search).toLowerCase();
      cards = cards.filter(
        (c) =>
          (c.className || '').toLowerCase().includes(q) ||
          (c.lessonTitle || '').toLowerCase().includes(q) ||
          (c.teacherName || '').toLowerCase().includes(q)
      );
    }

    const lessonCount = cards.length;
    const uncompletedCount = cards.filter((c) => c.status !== 'completed').length;
    const totalStudentTimes = cards.reduce((s, c) => s + (c.totalStudents || 0), 0);
    const attendedTimes = cards.reduce((s, c) => s + (c.signedCount || 0), 0);
    const absentTimes = cards.reduce(
      (s, c) => s + (c.status === 'completed' ? Math.max(0, (c.totalStudents || 0) - (c.signedCount || 0)) : 0),
      0
    );
    const unsignedTimes = cards.reduce(
      (s, c) => s + (c.status !== 'completed' ? (c.totalStudents || 0) : 0),
      0
    );
    const signedRate = totalStudentTimes > 0 ? Math.round((attendedTimes / totalStudentTimes) * 100) : 0;

    return {
      success: true,
      data: {
        cards,
        stats: {
          lessonCount,
          uncompletedCount,
          totalStudentTimes,
          attendedTimes,
          absentTimes,
          unsignedTimes,
          signedRate,
        },
      },
    };
  },

  // ----------------------------------------------------------------------------
  // 班级全生命周期协调器 (Class Lifecycle Coordinator 接缝)
  // ----------------------------------------------------------------------------
  activateClass: (data: { classId: string; actualStartDate?: string; minStudentCount?: number }) =>
    request(`/api/educational/classes/${data.classId}/activate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  completeClass: (data: {
    classId: string;
    disposition: { mode: 'fallback_unassigned' } | { mode: 'transfer_next_class'; targetClassId: string } | { mode: 'archive_completed' };
    cancelFutureSchedules?: boolean;
    remark?: string;
  }) =>
    request(`/api/educational/classes/${data.classId}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelClass: (data: { classId: string; reason: string }) =>
    request(`/api/educational/classes/${data.classId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  mergeClasses: (data: {
    sourceClassIds: string[];
    targetClassId: string;
    sourceDisposition?: 'complete' | 'keep_empty';
    reason?: string;
  }) =>
    request('/api/educational/classes/merge', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  previewClassLifecycle: (classId: string, data: any) =>
    request(`/api/educational/classes/${classId}/preview-lifecycle`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 随堂课评与微信通知出站信箱协调器 (LessonEvaluationCoordinator)
  getEvaluationWorkbench: (scheduleEventId: string) =>
    request(`/api/educational/lesson-evaluations/workbench/${scheduleEventId}`),

  commitEvaluation: (data: {
    scheduleEventId: string;
    publish: boolean;
    dispatchStrategy?: 'ATTENDED_ONLY' | 'ALL_ROSTER' | 'UNSENT_RETRY';
    idempotencyKey?: string;
    payload: any;
  }) =>
    request('/api/educational/lesson-evaluations/commit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getEvaluationDetail: (scheduleEventId: string) =>
    request(`/api/educational/lesson-evaluations/${scheduleEventId}`),

  // 统一结课履约协调器 (LessonFulfillmentCoordinator)
  getFulfillmentWorkbench: (scheduleEventId: string) =>
    request(`/api/educational/fulfillment/workbench/${scheduleEventId}`),

  fulfillLesson: (data: {
    scheduleEventId: string;
    mode?: 'FULL_SETTLE' | 'ATTENDANCE_ONLY' | 'PUBLISH_EVALUATION';
    lessonTitle?: string;
    templateId?: string;
    templateName?: string;
    studyContentHtml?: string;
    overallRating?: number;
    teacherComment?: string;
    voiceUrl?: string;
    voiceDuration?: number;
    videoUrl?: string;
    photoList?: string[];
    aiPolished?: boolean;
    anomalyOverrides?: Array<{
      studentId: string;
      status?: 'present' | 'late' | 'leave' | 'absent';
      deductLessons?: number;
      rating?: number;
      personalizedComment?: string;
      performanceTag?: string;
    }>;
    dispatchStrategy?: 'ATTENDED_ONLY' | 'ALL_ENROLLED' | 'NONE';
    idempotencyKey?: string;
  }) =>
    request('/api/educational/fulfillment/fulfill', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reverseFulfillment: (data: {
    scheduleEventId: string;
    strategy?: 'FULL_ROLLBACK' | 'REOPEN_EVALUATION';
    reason?: string;
  }) =>
    request('/api/educational/fulfillment/reverse', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

