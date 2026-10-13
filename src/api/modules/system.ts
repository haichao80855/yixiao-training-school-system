import { request } from '@/utils/request';
import {
  normalizeOrgNode,
  normalizeUser,
  normalizeRole,
  normalizeDictItem,
  normalizePermissionNode
} from '../normalizers/system';

export const systemApi = {
  getCompanyInfo: (fallbackData?: any) =>
    request('/api/system/company', { fallbackData }),

  updateCompanyInfo: (data: any) =>
    request('/api/system/company', { method: 'PUT', body: JSON.stringify(data) }),

  transferSuperAdmin: (data: { targetUserId: string; password: string }) =>
    request('/api/system/company/transfer-admin', { method: 'POST', body: JSON.stringify(data) }),

  getCampuses: (fallbackData?: any) =>
    request('/api/system/campuses', { fallbackData }),

  getOrgTree: async (fallbackData?: any) => {
    const res = await request('/api/system/org-tree', { fallbackData });
    if (res && res.data && Array.isArray(res.data)) {
      res.data = res.data.map(normalizeOrgNode) as any;
    }
    return res;
  },

  createOrgNode: (data: any) =>
    request('/api/system/org-tree', { method: 'POST', body: JSON.stringify(data) }),

  updateOrgNode: (id: string, data: any) =>
    request(`/api/system/org-tree/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteOrgNode: (id: string) =>
    request(`/api/system/org-tree/${id}`, { method: 'DELETE' }),

  getPermissions: async (params?: any, fallbackData?: any) => {
    const res = await request('/api/system/permissions', { params, fallbackData });
    if (res && res.data && Array.isArray(res.data)) {
      res.data = res.data.map(normalizePermissionNode) as any;
    }
    return res;
  },

  getRoles: async (fallbackData?: any) => {
    const res = await request('/api/system/roles', { fallbackData });
    if (res && res.data && Array.isArray(res.data)) {
      res.data = res.data.map(normalizeRole) as any;
    }
    return res;
  },

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

  getUsers: async (params?: any, fallbackData?: any) => {
    const res = await request('/api/system/users', { params, fallbackData });
    if (res && res.data) {
      if (Array.isArray(res.data)) {
        res.data = res.data.map(normalizeUser) as any;
      } else if (Array.isArray(res.data.list)) {
        res.data.list = res.data.list.map(normalizeUser);
      }
    }
    return res;
  },

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

  getDictItems: async (category?: string, fallbackData?: any) => {
    const res = await request('/api/system/dict-items', { params: { category }, fallbackData });
    if (res && res.data && Array.isArray(res.data)) {
      res.data = res.data.map(normalizeDictItem) as any;
    }
    return res;
  },

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
};
