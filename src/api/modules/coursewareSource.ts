import { request } from '@/utils/request'

/**
 * 课件来源：平时用盛通 / 百家云原链接，原平台不可用时由后端改发自有 OSS 备份的限时链接。
 */
export type CoursewareSourceMode = 'auto' | 'origin' | 'mirror'

export interface CoursewareResolveResult {
  source: 'origin' | 'mirror' | 'unavailable'
  viewer?: 'iframe' | 'office' | 'download' | 'none'
  url: string
  message?: string
}

export interface CoursewareProviderStatus {
  state: 'unknown' | 'up' | 'down'
  since: string | null
  lastCheckedAt: string | null
  lastRound: { ok: number; fail: number; samples: number } | null
  lastFailures: string[]
  effective: 'origin' | 'mirror'
}

export interface CoursewareSourceStatus {
  mode: CoursewareSourceMode
  probeEnabled: boolean
  probeIntervalMinutes: number
  officePreview: boolean
  storageEngine: string
  providers: { shengtong: CoursewareProviderStatus; baijiayun: CoursewareProviderStatus }
}

export interface CoursewareResolveInput {
  purpose: 'download' | 'preview'
  downloadUrl?: string
  pptUrl?: string
  filename?: string
}

export const coursewareSourceApi = {
  resolve: async (input: CoursewareResolveInput): Promise<CoursewareResolveResult> => {
    const res = await request<CoursewareResolveResult>('/api/curriculum/courseware/resolve', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return res.data
  },

  getStatus: async (): Promise<CoursewareSourceStatus> =>
    (await request<CoursewareSourceStatus>('/api/curriculum/courseware/source')).data,

  setMode: async (mode: CoursewareSourceMode): Promise<CoursewareSourceStatus> =>
    (
      await request<CoursewareSourceStatus>('/api/curriculum/courseware/source', {
        method: 'PUT',
        body: JSON.stringify({ mode }),
      })
    ).data,

  probeNow: async (): Promise<CoursewareSourceStatus> =>
    (await request<CoursewareSourceStatus>('/api/curriculum/courseware/source/probe', { method: 'POST' })).data,
}
