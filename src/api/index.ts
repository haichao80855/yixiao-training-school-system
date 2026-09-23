import { request } from '@/utils/request'

export const authApi = {
  login: (data: { account: string; password: string }) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getProfile: () => request('/api/auth/profile'),
}

export const systemApi = {
  getCampuses: () => request('/api/system/campuses'),
  getOrgTree: () => request('/api/system/org-tree'),
  getRoles: () => request('/api/system/roles'),
  getPermissions: () => request('/api/system/permissions'),
  getDictItems: () => request('/api/system/dict-items'),
}

export const curriculumApi = {
  getCourses: (params?: any) => request('/api/curriculum/courses', { params }),
  getCourseById: (id: string) => request(`/api/curriculum/courses/${id}`),
  createCourse: (data: any) =>
    request('/api/curriculum/courses', { method: 'POST', body: JSON.stringify(data) }),
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
  getUnits: (id: string) => request(`/api/curriculum/courses/${id}/units`),
  createUnit: (id: string, data: any) =>
    request(`/api/curriculum/courses/${id}/units`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

export const studentApi = {
  getStudents: (params?: any) => request('/api/students', { params }),
  getStudentById: (id: string) => request(`/api/students/${id}`),
  createStudent: (data: any) =>
    request('/api/students', { method: 'POST', body: JSON.stringify(data) }),
  getStudentProfile: (id: string) => request(`/api/students/${id}/profile`),
  enroll: (data: any) =>
    request('/api/students/enroll', { method: 'POST', body: JSON.stringify(data) }),
  executeMovement: (id: string, data: any) =>
    request(`/api/students/${id}/movement`, { method: 'POST', body: JSON.stringify(data) }),
}

export const educationalApi = {
  getClassrooms: (campusId?: string) =>
    request('/api/educational/classrooms', { params: { campusId } }),
  getClasses: (params?: any) => request('/api/educational/classes', { params }),
  createClass: (data: any) =>
    request('/api/educational/classes', { method: 'POST', body: JSON.stringify(data) }),
  checkCollision: (data: any) =>
    request('/api/educational/schedules/check-collision', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSchedules: (params?: any) => request('/api/educational/schedules', { params }),
  createSchedule: (data: any) =>
    request('/api/educational/schedules', { method: 'POST', body: JSON.stringify(data) }),
  getRollCallStudents: (scheduleId: string) =>
    request(`/api/educational/schedules/${scheduleId}/roll-call-students`),
  rollCall: (data: any) =>
    request('/api/educational/attendances/roll-call', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reverseSchedule: (scheduleId: string) =>
    request(`/api/educational/schedules/${scheduleId}/reverse`, {
      method: 'POST',
    }),
}

export const financialApi = {
  getOrders: (params?: any) => request('/api/financial/orders', { params }),
  getOrderSummary: (params?: any) => request('/api/financial/orders/summary', { params }),
  getOrderById: (id: string) => request(`/api/financial/orders/${id}`),
  updateVoucher: (id: string, voucherUrl: string) =>
    request(`/api/financial/orders/${id}/voucher`, {
      method: 'PATCH',
      body: JSON.stringify({ voucherUrl }),
    }),
  lockOrder: (id: string, isLocked: boolean) =>
    request(`/api/financial/orders/${id}/lock`, {
      method: 'PATCH',
      body: JSON.stringify({ isLocked }),
    }),
  voidOrder: (id: string) =>
    request(`/api/financial/orders/${id}/void`, { method: 'POST' }),
  getApprovals: (params?: any) => request('/api/financial/approvals', { params }),
  createApproval: (data: any) =>
    request('/api/financial/approvals', { method: 'POST', body: JSON.stringify(data) }),
  auditApproval: (id: string, data: { action: string; comment: string; stepName?: string }) =>
    request(`/api/financial/approvals/${id}/audit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
