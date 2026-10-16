export interface ApiResponse<T = any> {
  code?: number;
  data: T;
  message?: string;
  success?: boolean;
}

const BASE_URL = 'https://17a6937c.r38.cpolar.top';

// 401 防并发抖动重定向锁
let isRedirecting = false;

export async function request<T = any>(options: {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  header?: Record<string, string>;
}): Promise<T> {
  const token = uni.getStorageSync('token');
  const campusId = uni.getStorageSync('currentCampusId');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(campusId && campusId !== 'all' ? { 'x-campus-id': campusId } : {}),
    ...options.header,
  };

  const fullUrl = `${BASE_URL}${options.url.startsWith('/') ? '' : '/'}${options.url}`;

  // 对于 GET 请求，过滤 undefined、null 和空字符串，防止被转成 ?param=undefined
  let requestData = options.data;
  if ((!options.method || options.method === 'GET') && options.data && typeof options.data === 'object' && !Array.isArray(options.data)) {
    requestData = Object.entries(options.data).reduce((acc: any, [key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        acc[key] = val;
      }
      return acc;
    }, {});
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method: (options.method || 'GET') as any,
      data: requestData,
      header: headers,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data as any;
          // 智能解包：如果后端返回 { code: 200, data: ..., message: ... } 则提取内部 data
          const payload = body && typeof body === 'object' && body.data !== undefined ? body.data : body;
          resolve(payload as T);
        } else if (res.statusCode === 401) {
          uni.removeStorageSync('token');

          // 检测当前页面是否已在登录页，避免死循环重定向
          let isOnLoginPage = false;
          try {
            if (typeof getCurrentPages === 'function') {
              const pages = getCurrentPages();
              if (pages && pages.length > 0) {
                const currentPage = pages[pages.length - 1];
                const route = (currentPage as any).route || (currentPage as any).__route__ || '';
                if (route.includes('pages/login/index')) {
                  isOnLoginPage = true;
                }
              }
            }
          } catch (e) {}

          // 1500ms 防抖锁：防止并发多个请求 401 时触发多次 Toast 弹窗与重复重定向
          if (!isRedirecting && !isOnLoginPage) {
            isRedirecting = true;
            uni.showToast({ title: '登录已失效，请重新登录', icon: 'none' });
            uni.reLaunch({ url: '/pages/login/index' });
            setTimeout(() => {
              isRedirecting = false;
            }, 1500);
          }
          reject(new Error('Unauthorized'));
        } else {
          const body = res.data as any;
          const errMsg = body?.message || '请求处理失败';
          const msg = Array.isArray(errMsg) ? errMsg[0] : errMsg;
          // 对于 409 Conflict 财务风控强拦截，不弹出全局通用 Toast 干扰业务层不可穿透 Modal
          if (res.statusCode !== 409) {
            uni.showToast({ title: msg, icon: 'none' });
          }
          const error: any = new Error(msg);
          error.status = res.statusCode;
          error.statusCode = res.statusCode;
          error.data = body;
          error.code = body?.code || (res.statusCode === 409 ? 'REFUND_LOCKED' : undefined);
          reject(error);
        }
      },
      fail: (err: any) => {
        console.error(`[HTTP] 请求失败 ${fullUrl}:`, err);
        let tip = '网络连接异常，请重试';
        if (err?.errMsg && (err.errMsg.includes('fail') || err.errMsg.includes('refused'))) {
          tip = '无法连接到后端服务 (请确认 3001 端口已启动并勾选“不校验合法域名”)';
        }
        uni.showToast({ title: tip, icon: 'none', duration: 3000 });
        reject(err);
      },
    });
  });
}
