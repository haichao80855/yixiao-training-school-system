/**
 * 拓视未来教育「一校教培系统」通用网络请求客户端 (Dual-Track HTTP Client)
 * 自动注入当前校区租户 ID (X-Campus-Id) 与本人登录的 JWT Bearer Token；401 时清除会话并回到登录页
 */

interface RequestOptions extends RequestInit {
  params?: Record<string, any>
  fallbackData?: any
  /** 超时毫秒数：默认查询 15 秒、写操作 30 秒、上传文件不设超时；传 0 表示不设超时 */
  timeoutMs?: number
}

const DEFAULT_READ_TIMEOUT_MS = 15000
const DEFAULT_WRITE_TIMEOUT_MS = 30000

/** 请求超时：网络卡住时按钮和表格不会一直转圈，调用方照常收到错误并提示 */
export class RequestTimeoutError extends Error {
  status = 0
  constructor(message = '网络较慢，请求超时，请稍后重试') {
    super(message)
    this.name = 'RequestTimeoutError'
  }
}

const TOKEN_KEY = 'yixiao_auth_token'
const USER_KEY = 'yixiao_auth_user'

/** 会话失效 (无有效登录凭据 / 服务端 401)：不得回退本地数据，必须回到登录页重新登录 */
export class SessionExpiredError extends Error {
  constructor(message = '登录已失效，请重新登录') {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

/** 只读取本人登录得到的真实 JWT；本地演示令牌 (mock- / st-token-) 不是有效凭据 */
function readAuthToken(): string {
  if (typeof localStorage === 'undefined') return ''
  const token = localStorage.getItem(TOKEN_KEY) || ''
  if (!token || token.startsWith('mock-') || token.startsWith('st-token-')) return ''
  return token
}

let redirectingToLogin = false

/**
 * 会话失效处理：清除本地登录状态并跳转登录页 (带回跳地址)。
 * 不再以任何内置账号静默重新登录——原实现会在 401 / 无令牌时自动以超级管理员身份换取令牌。
 */
function handleSessionExpired(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // 存储不可用时忽略
  }
  const { pathname, search, hash } = window.location
  if (pathname.startsWith('/login') || redirectingToLogin) return
  redirectingToLogin = true
  const redirect = encodeURIComponent(`${pathname}${search}${hash}`)
  // 整页跳转：同时重置内存中的登录状态 (Pinia)
  window.location.assign(`/login?redirect=${redirect}`)
}

export async function request<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<{ success: boolean; data: T; message?: string; fromMock?: boolean }> {
  const { params, fallbackData, timeoutMs, headers: customHeaders, ...fetchOptions } = options

  // 1. 构建 URL 查询参数
  let finalUrl = url
  if (params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value))
      }
    }
    const queryString = searchParams.toString()
    if (queryString) {
      finalUrl += (url.includes('?') ? '&' : '?') + queryString
    }
  }

  // 2. 获取当前的校区租户 ID 与本人登录的 Token (无有效 Token 时不携带 Authorization)
  const token = readAuthToken()
  const campusId = localStorage.getItem('yixiao_current_campus_id')

  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData

  const headers: Record<string, string> = {
    ...(campusId ? { 'X-Campus-Id': campusId } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(customHeaders as Record<string, string>),
  }

  // 若传入 body 不是 FormData，则设置默认的 application/json Content-Type
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  // 超时：用计时器和请求赛跑，网络卡住时按时报错 (不把自建的 AbortSignal 交给 fetch，
  // 测试环境里 jsdom 的 AbortSignal 和 Node 自带 fetch 不兼容)。调用方传入的 signal 照常交给 fetch。
  const method = (fetchOptions.method || 'GET').toUpperCase()
  const timeout = timeoutMs ?? (isFormData ? 0 : method === 'GET' ? DEFAULT_READ_TIMEOUT_MS : DEFAULT_WRITE_TIMEOUT_MS)
  let timer: ReturnType<typeof setTimeout> | null = null
  const withTimeout = <R,>(task: Promise<R>): Promise<R> => {
    if (!(timeout > 0)) return task
    return Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new RequestTimeoutError()), timeout)
      }),
    ])
  }

  try {
    const res = await withTimeout(fetch(finalUrl, {
      ...fetchOptions,
      headers,
    }))

    // 401：会话无效或已过期 → 清除登录状态并回到登录页 (登录接口自身的 401 是密码错误等，照常抛出)
    if (res.status === 401 && !url.includes('/api/auth/login')) {
      handleSessionExpired()
      throw new SessionExpiredError()
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}))
      const errorMsg = Array.isArray(errorJson.message)
        ? errorJson.message.join('; ')
        : (errorJson.message || errorJson.error || `HTTP ${res.status}: ${res.statusText}`)
      // 带上状态码，调用方才能区分“无权限 (403)”和其他失败
      throw Object.assign(new Error(errorMsg), { status: res.status })
    }

    const responseData = await res.json()
    return {
      success: true,
      data: responseData.data !== undefined ? responseData.data : responseData,
      message: responseData.message,
      fromMock: false,
    }
  } catch (err: any) {
    // 会话失效绝不回退本地数据，否则页面会在未登录状态下展示示例数据
    if (err instanceof SessionExpiredError) throw err
    // 关键防线：写操作绝对禁止回退 fallbackData！必须直接抛出异常阻断业务流程！
    const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    if (!isWriteOperation && fallbackData !== undefined) {
      console.warn(`[Dual-Track Request] 后端服务未连接，使用高保真本地数据: ${url}`)
      return {
        success: true,
        data: fallbackData,
        message: '来自本地高保真数据',
        fromMock: true,
      }
    }
    throw err
  } finally {
    if (timer) clearTimeout(timer)
  }
}
