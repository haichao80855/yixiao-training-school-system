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
  getCompanyInfo: (fallbackData?: any) =>
    request('/api/system/company', { fallbackData }),
  getCampuses: (fallbackData?: any) =>
    request('/api/system/campuses', { fallbackData }),
  getOrgTree: (fallbackData?: any) =>
    request('/api/system/org-tree', { fallbackData }),
  createOrgNode: (data: any) =>
    request('/api/system/org-tree', { method: 'POST', body: JSON.stringify(data) }),
  updateOrgNode: (id: string, data: any) =>
    request(`/api/system/org-tree/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrgNode: (id: string) =>
    request(`/api/system/org-tree/${id}`, { method: 'DELETE' }),

  getPermissions: (fallbackData?: any) =>
    request('/api/system/permissions', { fallbackData }),
  getRoles: (fallbackData?: any) =>
    request('/api/system/roles', { fallbackData }),
  createRole: (data: any) =>
    request('/api/system/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, data: any) =>
    request(`/api/system/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id: string) =>
    request(`/api/system/roles/${id}`, { method: 'DELETE' }),
  assignRolePermissions: (id: string, permissionCodes: string[]) =>
    request(`/api/system/roles/${id}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ permissionCodes }),
    }),

  getUsers: (params?: any, fallbackData?: any) =>
    request('/api/system/users', { params, fallbackData }),
  createUser: (data: any) =>
    request('/api/system/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) =>
    request(`/api/system/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request(`/api/system/users/${id}`, { method: 'DELETE' }),
  resetUserPassword: (id: string, password?: string) =>
    request(`/api/system/users/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    }),
  toggleUserStatus: (id: string, status?: string) =>
    request(`/api/system/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getDictItems: (category?: string, fallbackData?: any) =>
    request('/api/system/dict-items', { params: { category }, fallbackData }),
  createDictItem: (data: any) =>
    request('/api/system/dict-items', { method: 'POST', body: JSON.stringify(data) }),
  updateDictItem: (id: string, data: any) =>
    request(`/api/system/dict-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDictItem: (id: string) =>
    request(`/api/system/dict-items/${id}`, { method: 'DELETE' }),
  toggleDictItemStatus: (id: string, enabled?: boolean) =>
    request(`/api/system/dict-items/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
}

export const curriculumApi = {
  getCourses: (params?: any, fallbackData?: any) =>
    request('/api/curriculum/courses', { params, fallbackData }),
  getCourseById: (id: string, fallbackData?: any) =>
    request(`/api/curriculum/courses/${id}`, { fallbackData }),
  createCourse: (data: any) =>
    request('/api/curriculum/courses', { method: 'POST', body: JSON.stringify(data) }),
  updateCourse: (id: string, data: any) =>
    request(`/api/curriculum/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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
  getUnits: (id: string, fallbackData?: any) =>
    request(`/api/curriculum/courses/${id}/units`, { fallbackData }),
  createUnit: (id: string, data: any) =>
    request(`/api/curriculum/courses/${id}/units`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteUnit: (unitId: string) =>
    request(`/api/curriculum/units/${unitId}`, { method: 'DELETE' }),
  deleteLesson: (lessonId: string) =>
    request(`/api/curriculum/lessons/${lessonId}`, { method: 'DELETE' }),
}

export const studentApi = {
  getStudents: (params?: any, fallbackData?: any) =>
    request('/api/students', { params, fallbackData }),
  getStudentById: (id: string, fallbackData?: any) =>
    request(`/api/students/${id}`, { fallbackData }),
  createStudent: (data: any) =>
    request('/api/students', { method: 'POST', body: JSON.stringify(data) }),
  updateStudent: (id: string, data: any) =>
    request(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getStudentProfile: (id: string, fallbackData?: any) =>
    request(`/api/students/${id}/profile`, { fallbackData }),
  enroll: (data: any) =>
    request('/api/students/enroll', { method: 'POST', body: JSON.stringify(data) }),
  executeMovement: (id: string, data: any) =>
    request(`/api/students/${id}/movement`, { method: 'POST', body: JSON.stringify(data) }),
}

export const educationalApi = {
  getClassrooms: (campusId?: string, fallbackData?: any) =>
    request('/api/educational/classrooms', { params: { campusId }, fallbackData }),
  getClasses: (params?: any, fallbackData?: any) =>
    request('/api/educational/classes', { params, fallbackData }),
  createClass: (data: any) =>
    request('/api/educational/classes', { method: 'POST', body: JSON.stringify(data) }),
  updateClass: (id: string, data: any) =>
    request(`/api/educational/classes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  assignStudentsToClass: (id: string, studentIds: string[]) =>
    request(`/api/educational/classes/${id}/students`, {
      method: 'POST',
      body: JSON.stringify({ studentIds }),
    }),
  checkCollision: (data: any) =>
    request('/api/educational/schedules/check-collision', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSchedules: (params?: any, fallbackData?: any) =>
    request('/api/educational/schedules', { params, fallbackData }),
  createSchedule: (data: any) =>
    request('/api/educational/schedules', { method: 'POST', body: JSON.stringify(data) }),
  deleteSchedule: (id: string) =>
    request(`/api/educational/schedules/${id}`, { method: 'DELETE' }),
  getRollCallStudents: (scheduleId: string, fallbackData?: any) =>
    request(`/api/educational/schedules/${scheduleId}/roll-call-students`, { fallbackData }),
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
  getOrders: (params?: any, fallbackData?: any) =>
    request('/api/financial/orders', { params, fallbackData }),
  getOrderSummary: (params?: any, fallbackData?: any) =>
    request('/api/financial/orders/summary', { params, fallbackData }),
  getOrderById: (id: string, fallbackData?: any) =>
    request(`/api/financial/orders/${id}`, { fallbackData }),
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
  getApprovals: (params?: any, fallbackData?: any) =>
    request('/api/financial/approvals', { params, fallbackData }),
  createApproval: (data: any) =>
    request('/api/financial/approvals', { method: 'POST', body: JSON.stringify(data) }),
  auditApproval: (id: string, data: { action: string; comment: string; stepName?: string }) =>
    request(`/api/financial/approvals/${id}/audit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
