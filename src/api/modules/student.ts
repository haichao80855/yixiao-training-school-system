import { request } from '@/utils/request';
import { normalizeStudent } from '../normalizers/student';

export function adaptMovementDto(input: any): Record<string, any> {
  const td = input.targetData || {};

  const type = input.type || input.movementType || 'transfer_class';
  const packageId = input.packageId || td.packageId;
  const reasonCategory = input.reasonCategory || '学业或家庭调整';
  const reasonDetail = input.reasonDetail || `学员学籍异动业务流转: ${type}`;

  const targetClassId = input.targetClassId || input.toClassId || td.toClassId || td.targetClassId;
  const targetCourseId = input.targetCourseId || input.newCourseId || td.newCourseId || td.targetCourseId;
  const targetCampusId = input.targetCampusId || td.targetCampusId;
  const targetStudentId = input.targetStudentId || td.targetStudentId;

  const rawDays = input.suspendDays ?? input.suspensionDays ?? input.days ?? td.days ?? td.suspensionDays;
  const suspendDays = rawDays !== undefined ? Number(rawDays) : undefined;

  const rawRefund = input.refundAmount ?? input.deductionFee ?? td.deductionFee ?? td.refundAmount;
  const refundAmount = rawRefund !== undefined ? Number(rawRefund) : undefined;

  const dto: Record<string, any> = {
    type,
    reasonCategory,
    reasonDetail,
  };

  if (packageId) dto.packageId = packageId;
  if (targetClassId) dto.targetClassId = targetClassId;
  if (targetCourseId) dto.targetCourseId = targetCourseId;
  if (targetCampusId) dto.targetCampusId = targetCampusId;
  if (targetStudentId) dto.targetStudentId = targetStudentId;
  if (suspendDays !== undefined) dto.suspendDays = suspendDays;
  if (refundAmount !== undefined) dto.refundAmount = refundAmount;

  return dto;
}

export const studentApi = {
  getStudents: async (params?: any, fallbackData?: any) => {
    const res = await request('/api/students', { params, fallbackData });
    if (res && res.data) {
      if (Array.isArray(res.data)) {
        res.data = res.data.map(normalizeStudent) as any;
      } else if (Array.isArray(res.data.list)) {
        res.data.list = res.data.list.map(normalizeStudent);
      }
    }
    return res;
  },

  getStudentById: async (id: string, fallbackData?: any) => {
    const res = await request(`/api/students/${id}`, { fallbackData });
    if (res && res.data) {
      res.data = normalizeStudent(res.data);
    }
    return res;
  },

  getStudentProfile: async (id: string, fallbackData?: any) => {
    const res = await request(`/api/students/${id}/profile`, { fallbackData });
    if (res && res.data) {
      res.data = normalizeStudent(res.data);
    }
    return res;
  },

  createStudent: (data: any) =>
    request('/api/students', { method: 'POST', body: JSON.stringify(data) }),

  updateStudent: (id: string, data: any) =>
    request(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteStudent: (id: string) =>
    request(`/api/students/${id}`, { method: 'DELETE' }),

  enroll: (data: any) =>
    request('/api/students/enroll', { method: 'POST', body: JSON.stringify(data) }),

  executeMovement: (id: string, data: any) => {
    const flatDto = adaptMovementDto(data);
    return request(`/api/students/${id}/movement`, { method: 'POST', body: JSON.stringify(flatDto) });
  },

  rechargeWallet: (id: string, data: { amount: number; bonus?: number; operator?: string; remark?: string }) =>
    request(`/api/students/${id}/wallet/recharge`, { method: 'POST', body: JSON.stringify(data) }),

  withdrawWallet: (id: string, data: { amount: number; reason?: string; operator?: string }) =>
    request(`/api/students/${id}/wallet/withdraw`, { method: 'POST', body: JSON.stringify(data) }),

  getUnassignedStudents: async (params?: any, fallbackData?: any) =>
    request('/api/students', { params: { ...params, status: 'normal' }, fallbackData }),
};
