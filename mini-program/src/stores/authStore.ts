import { defineStore } from 'pinia';
import { request } from '../utils/request';
import { parentApi } from '../api/parent';
import { useParentStore } from './parentStore';

export type AccountType = 'staff' | 'parent';

/** 家长端首页 (课评) */
export const PARENT_HOME = '/package-parent/evaluations/index';

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
    accountType: (uni.getStorageSync('accountType') || 'staff') as AccountType,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    isParent: (state) => state.accountType === 'parent',
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
      this.accountType = 'staff';
      uni.setStorageSync('accountType', 'staff');
      useParentStore().clear();
      uni.setStorageSync('token', res.accessToken);
      uni.setStorageSync('userInfo', JSON.stringify(res.user));
      uni.setStorageSync('currentCampusId', res.user.campusId);
      return res.user;
    },
    /**
     * 家长登录：账号为学员档案中的家长手机号，密码为手机号后 6 位
     */
    async loginParent(phone: string, password: string) {
      const wxCode = await new Promise<string | undefined>((resolve) => {
        uni.login({
          provider: 'weixin',
          success: (res) => resolve(res.code),
          fail: () => resolve(undefined),
        });
      });
      let deviceLabel: string | undefined;
      try {
        const info = uni.getSystemInfoSync();
        deviceLabel = [info.brand, info.model].filter(Boolean).join(' ') || undefined;
      } catch {}

      const res = await parentApi.login({ phone, password, wxCode, deviceLabel });
      this.token = res.accessToken;
      this.user = null;
      this.accountType = 'parent';
      uni.setStorageSync('token', res.accessToken);
      uni.setStorageSync('accountType', 'parent');
      uni.removeStorageSync('userInfo');
      useParentStore().hydrate({
        children: res.children,
        currentStudentId: res.currentStudentId,
        phoneMasked: res.account.phoneMasked,
      });
      return res;
    },
    logout() {
      if (this.accountType === 'parent' && this.token) {
        // 服务端注销当前会话，失败不阻塞本地退出
        parentApi.logout().catch(() => undefined);
      }
      this.token = '';
      this.user = null;
      uni.removeStorageSync('token');
      uni.removeStorageSync('userInfo');
      useParentStore().clear();
      uni.reLaunch({ url: '/pages/login/index' });
    },
  },
});
