import { request } from '@/utils/request';
import { normalizeOrder, normalizeApproval, normalizeLedgerRecord } from '../normalizers/financial';

export const financialApi = {
  // 订单账本
  getOrders: async (params?: any, fallbackData?: any) => {
    const res = await request('/api/financial/orders', { params, fallbackData });
    if (res && res.data) {
      if (Array.isArray(res.data)) {
        res.data = res.data.map(normalizeOrder) as any;
      } else if (Array.isArray(res.data.list)) {
        res.data.list = res.data.list.map(normalizeOrder);
      }
    }
    return res;
  },

  getLedgers: async (params?: any, fallbackData?: any) => {
    const res = await request('/api/financial/orders', { params, fallbackData });
    if (res && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.items || res.data.list || []);
      return { ...res, data: list.map(normalizeLedgerRecord) };
    }
    return res;
  },

  getOrderSummary: (params?: any, fallbackData?: any) =>
    request('/api/financial/orders/summary', { params, fallbackData }),

  getOrderById: async (id: string, fallbackData?: any) => {
    const res = await request(`/api/financial/orders/${id}`, { fallbackData });
    if (res && res.data) {
      res.data = normalizeOrder(res.data);
    }
    return res;
  },

  updateOrder: (id: string, data: any) =>
    request(`/api/financial/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateVoucher: (id: string, payload: string | { voucherUrl: string; auditRemark?: string; auditor?: string }) => {
    const body = typeof payload === 'string' ? { voucherUrl: payload } : payload;
    return request(`/api/financial/orders/${id}/voucher`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  lockOrder: (id: string, isLocked: boolean) =>
    request(`/api/financial/orders/${id}/lock`, {
      method: 'PATCH',
      body: JSON.stringify({ isLocked }),
    }),

  voidOrder: (id: string) =>
    request(`/api/financial/orders/${id}/void`, { method: 'POST' }),

  // 审批中心
  getApprovals: async (params?: any, fallbackData?: any) => {
    const res = await request('/api/financial/approvals', { params, fallbackData });
    if (res && res.data) {
      if (Array.isArray(res.data)) {
        res.data = res.data.map(normalizeApproval) as any;
      } else if (Array.isArray(res.data.list)) {
        res.data.list = res.data.list.map(normalizeApproval);
      }
    }
    return res;
  },

  createApproval: (data: any) =>
    request('/api/financial/approvals', { method: 'POST', body: JSON.stringify(data) }),

  auditApproval: (id: string, data: { action: string; comment: string; stepName?: string }) =>
    request(`/api/financial/approvals/${id}/audit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
