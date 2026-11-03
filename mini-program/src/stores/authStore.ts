import { defineStore } from 'pinia';
import { request } from '../utils/request';
import { parentApi } from '../api/parent';
import { useParentStore } from './parentStore';

export type AccountType = 'staff' | 'parent';

/** 家长端首页 (课评) */
export const PARENT_HOME = '/package-parent/evaluations/index';

/** 网页版登录设备名：系统 + 浏览器，如「iPhone 微信」「Android Chrome」，便于在「登录设备」中辨认 */
export function webDeviceLabel(ua: string): string {
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : '网页';
  const browser = /MicroMessenger/.test(ua)
    ? '微信'
    : /EdgA?\//.test(ua)
      ? 'Edge'
      : /(Chrome|CriOS)\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : '浏览器';
  return `${os} ${browser}`;
}

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
      let wxCode: string | undefined;
      // #ifdef MP-WEIXIN
      wxCode = await new Promise<string | undefined>((resolve) => {
        uni.login({
          provider: 'weixin',
          success: (res) => resolve(res.code),
          fail: () => resolve(undefined),
        });
      });
      // #endif
      let deviceLabel: string | undefined;
      try {
        // #ifdef MP-WEIXIN
        const info = uni.getSystemInfoSync();
        deviceLabel = [info.brand, info.model].filter(Boolean).join(' ') || undefined;
        // #endif
        // #ifdef H5
        deviceLabel = webDeviceLabel(navigator.userAgent);
        // #endif
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
