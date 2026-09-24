/**
 * 拓视未来教育「一校教培系统」通用网络请求客户端 (Dual-Track HTTP Client)
 * 自动注入当前校区租户 ID (X-Campus-Id) 与 JWT Bearer Token
 */

interface RequestOptions extends RequestInit {
  params?: Record<string, any>
  fallbackData?: any
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

  // 2. 获取当前的校区租户 ID 与 Token
  const token = localStorage.getItem('yixiao_auth_token') || ''
  const campusId = localStorage.getItem('yixiao_current_campus_id') || 'campus-bj-hq'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Campus-Id': campusId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(customHeaders as Record<string, string>),
  }

  try {
    const res = await fetch(finalUrl, {
      ...fetchOptions,
      headers,
    })

    if (!res.ok) {
      // 若遇到 401 且未登录，可抛出或交由上层处理
      const errorJson = await res.json().catch(() => ({}))
      throw new Error(errorJson.message || `HTTP ${res.status}: ${res.statusText}`)
    }

    const responseData = await res.json()
    return {
      success: true,
      data: responseData.data !== undefined ? responseData.data : responseData,
      message: responseData.message,
      fromMock: false,
    }
  } catch (err: any) {
    // 双轨降级容错机制：当后端离线或未启动时，若提供了 fallbackData 则无缝使用本地数据
    if (fallbackData !== undefined) {
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
