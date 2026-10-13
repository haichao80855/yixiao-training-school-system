import { request } from '@/utils/request';
import { normalizeCourse, normalizeCourseUnit } from '../normalizers/curriculum';

export const curriculumApi = {
  getCourses: async (params?: any, fallbackData?: any) => {
    const res = await request('/api/curriculum/courses', { params, fallbackData });
    if (res && res.data) {
      if (Array.isArray(res.data)) {
        res.data = res.data.map(normalizeCourse) as any;
      } else if (Array.isArray(res.data.list)) {
        res.data.list = res.data.list.map(normalizeCourse);
      }
    }
    return res;
  },

  getCourseById: async (id: string, fallbackData?: any) => {
    const res = await request(`/api/curriculum/courses/${id}`, { fallbackData });
    if (res && res.data) {
      res.data = normalizeCourse(res.data);
    }
    return res;
  },

  createCourse: (data: any) =>
    request('/api/curriculum/courses', { method: 'POST', body: JSON.stringify(data) }),

  updateCourse: (id: string, data: any) =>
    request(`/api/curriculum/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  saveCourse: (data: any) => {
    if (data.id) {
      return curriculumApi.updateCourse(data.id, data);
    }
    return curriculumApi.createCourse(data);
  },

  updateStatus: (id: string, status: string) =>
    request(`/api/curriculum/courses/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  authorizeCampuses: (id: string, campusIds: string[]) =>
    request(`/api/curriculum/courses/${id}/campus-auth`, {
      method: 'POST',
      body: JSON.stringify({ campusIds }),
    }),

  batchAuthorizeCampuses: async (courseIds: string[], campusIds: string[]) => {
    const results = await Promise.all(
      courseIds.map((cid) =>
        request(`/api/curriculum/courses/${cid}/campus-auth`, {
          method: 'POST',
          body: JSON.stringify({ campusIds }),
        })
      )
    );
    return { success: true, data: results.map((r) => r.data) };
  },

  getUnits: async (id: string, fallbackData?: any) => {
    const res = await request(`/api/curriculum/courses/${id}/units`, { fallbackData });
    if (res && res.data && Array.isArray(res.data)) {
      res.data = res.data.map(normalizeCourseUnit) as any;
    }
    return res;
  },

  createUnit: (id: string, data: any) =>
    request(`/api/curriculum/courses/${id}/units`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteUnit: (unitId: string) =>
    request(`/api/curriculum/units/${unitId}`, { method: 'DELETE' }),

  deleteLesson: (lessonId: string) =>
    request(`/api/curriculum/lessons/${lessonId}`, { method: 'DELETE' }),
};
