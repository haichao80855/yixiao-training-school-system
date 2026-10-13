import { request } from '@/utils/request';

export const authApi = {
  login: (data: { account: string; password: string }) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getProfile: () => request('/api/auth/profile'),
};
