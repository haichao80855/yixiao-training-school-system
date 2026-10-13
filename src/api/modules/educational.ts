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
    if (ids.length === 1) {
      return request(`/api/educational/classes/${classId}/students`, {
        method: 'POST',
        body: JSON.stringify({ studentId: ids[0] }),
      });
    }
    const results = await Promise.all(
      ids.map((id) =>
        request(`/api/educational/classes/${classId}/students`, {
          method: 'POST',
          body: JSON.stringify({ studentId: id }),
        })
      )
    );
    return {
      success: true,
      data: results.map((r) => r.data),
      message: `成功为班级关联 ${results.length} 名在读学员`,
    };
  },

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

  getAttendanceRecords: async (params?: any, fallbackData?: any) => {
    const res = await request('/api/educational/attendances', { params, fallbackData });
    if (res && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.list || []);
      return { ...res, data: list.map(normalizeAttendanceRecord) };
    }
    return res;
  },

  // 讲师与人员
  getTeachers: async (campusId?: string, fallbackData?: any) => {
    const res = await request('/api/system/users', {
      params: { campusId: campusId && campusId !== 'all' ? campusId : undefined, pageSize: 100 },
      fallbackData,
    });
    if (res && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.list || []);
      const teachers = list.filter((u: any) => {
        const role = u.roleName || u.postName || '';
        return role.includes('讲师') || role.includes('教师') || role.includes('学管') || role.includes('班主任') || u.roleId === 'r3';
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
};
