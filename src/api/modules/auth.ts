import { request } from '@/utils/request';

// 页面加载时 authStore 核验会话、tenantStore 读取可切换校区，都要读本人资料。
// 同一登录令牌下，进行中的请求和 5 秒内成功的结果直接复用，避免每次加载都请求两遍
const PROFILE_REUSE_MS = 5000;
let profileCache: { token: string; at: number; promise: ReturnType<typeof request<any>> } | null = null;

function currentToken(): string {
  try {
    return localStorage.getItem('yixiao_auth_token') || '';
  } catch {
    return '';
  }
}

function getProfileShared() {
  const token = currentToken();
  if (profileCache && profileCache.token === token && Date.now() - profileCache.at < PROFILE_REUSE_MS) {
    return profileCache.promise;
  }
  const promise = request('/api/auth/profile');
  const entry = { token, at: Date.now(), promise };
  profileCache = entry;
  // 失败的结果不复用
  promise.catch(() => {
    if (profileCache === entry) profileCache = null;
  });
  return promise;
}

export const authApi = {
  login: (data: { account: string; password: string }) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getProfile: () => getProfileShared(),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
