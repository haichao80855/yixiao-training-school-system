import { defineStore } from 'pinia';
import { request } from '../utils/request';

export interface UserRoleInfo {
  code: string;
  name: string;
  dataScope: string;
}

export interface UserProfile {
  id: string;
  account: string;
  realName: string;
  phone?: string;
  campusId: string;
  campusName: string;
  departmentId?: string;
  dataScope: string;
  roles: UserRoleInfo[];
  permissions: string[];
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: (uni.getStorageSync('token') || '') as string,
    user: (uni.getStorageSync('userInfo') ? JSON.parse(uni.getStorageSync('userInfo')) : null) as UserProfile | null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    roleNames: (state) => state.user?.roles.map((r) => r.name) || [],
  },
  actions: {
    async login(account: string, pass: string) {
      const res = await request<{ accessToken: string; user: UserProfile }>({
        url: '/api/auth/login',
        method: 'POST',
        data: { account, password: pass },
      });
      this.token = res.accessToken;
      this.user = res.user;
      uni.setStorageSync('token', res.accessToken);
      uni.setStorageSync('userInfo', JSON.stringify(res.user));
      uni.setStorageSync('currentCampusId', res.user.campusId);
      return res.user;
    },
    logout() {
      this.token = '';
      this.user = null;
      uni.removeStorageSync('token');
      uni.removeStorageSync('userInfo');
      uni.reLaunch({ url: '/pages/login/index' });
    },
  },
});
