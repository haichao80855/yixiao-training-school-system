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

  const rawLessons = input.newPurchasedLessons ?? input.newLessons ?? td.newLessons ?? td.newPurchasedLessons;
  const newPurchasedLessons = rawLessons !== undefined ? Number(rawLessons) : undefined;

  const rawDays = input.suspendDays ?? input.suspensionDays ?? input.days ?? td.days ?? td.suspensionDays;
  const suspendDays = rawDays !== undefined ? Number(rawDays) : undefined;

  const rawExtend = input.extendExpiryDays ?? td.extendExpiryDays;
  const extendExpiryDays = rawExtend !== undefined ? Number(rawExtend) : undefined;

  const rawDeduction = input.deductionFee ?? td.deductionFee;
  const deductionFee = rawDeduction !== undefined ? Number(rawDeduction) : undefined;

  const rawRefund = input.refundAmount ?? input.customRefundAmount ?? td.customRefundAmount ?? td.refundAmount;
  const refundAmount = rawRefund !== undefined ? Number(rawRefund) : undefined;

  const transferWallet = input.transferWallet !== undefined ? Boolean(input.transferWallet) : undefined;

  const dto: Record<string, any> = {
    type,
    reasonCategory,
    reasonDetail,
  };

  if (packageId) dto.packageId = packageId;
  if (targetClassId) dto.targetClassId = targetClassId;
  if (targetCourseId) dto.targetCourseId = targetCourseId;
  if (newPurchasedLessons !== undefined) dto.newPurchasedLessons = newPurchasedLessons;
  if (targetCampusId) dto.targetCampusId = targetCampusId;
  if (targetStudentId) dto.targetStudentId = targetStudentId;
  if (transferWallet !== undefined) dto.transferWallet = transferWallet;
  if (suspendDays !== undefined) dto.suspendDays = suspendDays;
  if (extendExpiryDays !== undefined) dto.extendExpiryDays = extendExpiryDays;
  if (deductionFee !== undefined) dto.deductionFee = deductionFee;
  if (refundAmount !== undefined) dto.refundAmount = refundAmount;

  return dto;
}

export interface ServiceFeeRecordItem {
  id: string;
  certNo: string;
  studentId: string;
  studentName: string;
  studentNo: string;
  campusId: string;
  campusName: string;
  examType: string;
  category: 'certification' | 'competition' | string;
  fee: number;
  invoiceTitle?: string;
  yikuaibaoVoucherNo?: string;
  status: 'pending' | 'verified' | string;
  createTime: string;
  verifyTime?: string | null;
  operator: string;
  voucherImage?: string;
}

export interface ServiceFeeQueryParams {
  campusId?: string;
  status?: string;
  category?: string;
  keyword?: string;
}

export interface CreateServiceFeeParams {
  certNo?: string;
  studentId: string;
  studentName: string;
  studentNo: string;
  campusId: string;
  campusName: string;
  examType: string;
  category: string;
  fee: number;
  invoiceTitle?: string;
  yikuaibaoVoucherNo?: string;
  voucherImage?: string;
}

export interface BatchVerifyServiceFeeParams {
  ids: string[];
  yikuaibaoVoucherNo?: string;
  operator?: string;
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

  previewMovement: (id: string, data: any) => {
    const flatDto = adaptMovementDto(data);
    return request(`/api/students/${id}/movement/preview`, { method: 'POST', body: JSON.stringify(flatDto) });
  },

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

  // 考务代报名与服务费账本
  getServiceFees: (params?: ServiceFeeQueryParams, fallbackData?: ServiceFeeRecordItem[]) =>
    request<ServiceFeeRecordItem[]>('/api/students/service-fees', { params, fallbackData }),

  createServiceFee: (data: CreateServiceFeeParams) =>
    request<ServiceFeeRecordItem>('/api/students/service-fees', { method: 'POST', body: JSON.stringify(data) }),

  verifyServiceFee: (id: string, yikuaibaoVoucherNo: string) =>
    request<ServiceFeeRecordItem>('/api/students/service-fees/verify', { method: 'POST', body: JSON.stringify({ id, yikuaibaoVoucherNo }) }),

  batchVerifyServiceFees: (data: BatchVerifyServiceFeeParams) =>
    request<{ success: boolean; count: number; message: string }>('/api/students/service-fees/batch-verify', { method: 'POST', body: JSON.stringify(data) }),

  deleteServiceFee: (id: string) =>
    request<{ success: boolean }>(`/api/students/service-fees/${id}`, { method: 'DELETE' }),

  // 课消风控与续费决策协调器 (LessonRenewalCoordinator)
  getCampusRenewalRoster: (params?: any, fallbackData?: any) =>
    request('/api/students/renewal/roster', { params, fallbackData }),

  getStudentRenewalRisk: (studentId: string, fallbackData?: any) =>
    request(`/api/students/${studentId}/renewal-risk`, { fallbackData }),

  createRenewalOrderDraft: (studentId: string, data?: any) =>
    request(`/api/students/${studentId}/renewal-draft`, { method: 'POST', body: JSON.stringify(data || {}) }),
};
