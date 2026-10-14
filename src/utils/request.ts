/**
 * 拓视未来教育「一校教培系统」通用网络请求客户端 (Dual-Track HTTP Client)
 * 自动注入当前校区租户 ID (X-Campus-Id) 与 JWT Bearer Token (支持自动静默获取与 401 自动重试)
 */

interface RequestOptions extends RequestInit {
  params?: Record<string, any>
  fallbackData?: any
}

let tokenPromise: Promise<string> | null = null

async function getValidAuthToken(): Promise<string> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return ''
  const currentToken = localStorage.getItem('yixiao_auth_token') || ''
  if (currentToken && !currentToken.startsWith('mock-') && !currentToken.startsWith('st-token-')) {
    return currentToken
  }

  // 若用户处于登录页或已显式退出登录，严禁静默覆盖为超管会话
  const hasLoggedOut = localStorage.getItem('yixiao_auth_has_logged_out') === 'true'
  const isLoginPage = typeof window !== 'undefined' && window.location?.pathname?.includes('/login')
  if (hasLoggedOut || isLoginPage) {
    return ''
  }

  // 若无有效真实 JWT Token 且非登录页环境，发起自动换取真实凭证
  if (!tokenPromise) {
    tokenPromise = (async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: 'donghaichao', password: '123456' }),
        })
        if (res.ok) {
          const json = await res.json()
          const jwt = json.data?.accessToken || json.token
          if (jwt) {
            localStorage.setItem('yixiao_auth_token', jwt)
            if (json.data?.user) {
              localStorage.setItem('yixiao_auth_user', JSON.stringify(json.data.user))
            }
            return jwt
          }
        }
      } catch (e) {
        console.warn('[Request] 静默换取真实JWT失败:', e)
      }
      return ''
    })()
  }

  const token = await tokenPromise
  tokenPromise = null
  return token
}

export async function request<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<{ success: boolean; data: T; message?: string; fromMock?: boolean }> {
  const { params, fallbackData, headers: customHeaders, ...fetchOptions } = options

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

  // 2. 获取当前的校区租户 ID 与 Token (支持自动静默获取真实有效 Token)
  let token = localStorage.getItem('yixiao_auth_token') || ''
  if (!token || token.startsWith('mock-')) {
    token = await getValidAuthToken()
  }
  const campusId = localStorage.getItem('yixiao_current_campus_id') || 'campus-bj-hq'

  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData

  const headers: Record<string, string> = {
    'X-Campus-Id': campusId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(customHeaders as Record<string, string>),
  }

  // 若传入 body 不是 FormData，则设置默认的 application/json Content-Type
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    let res = await fetch(finalUrl, {
      ...fetchOptions,
      headers,
    })

    // 若遇到 401，尝试刷新真实 Token 并自动重试一次
    if (res.status === 401 && !url.includes('/api/auth/login')) {
      localStorage.removeItem('yixiao_auth_token')
      const freshToken = await getValidAuthToken()
      if (freshToken) {
        headers['Authorization'] = `Bearer ${freshToken}`
        res = await fetch(finalUrl, {
          ...fetchOptions,
          headers,
        })
      }
    }

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}))
      const errorMsg = Array.isArray(errorJson.message)
        ? errorJson.message.join('; ')
        : (errorJson.message || errorJson.error || `HTTP ${res.status}: ${res.statusText}`)
      throw new Error(errorMsg)
    }

    const responseData = await res.json()
    return {
      success: true,
      data: responseData.data !== undefined ? responseData.data : responseData,
      message: responseData.message,
      fromMock: false,
    }
  } catch (err: any) {
    // 关键防线：写操作绝对禁止回退 fallbackData！必须直接抛出异常阻断业务流程！
    const method = (fetchOptions.method || 'GET').toUpperCase()
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
  }
}
