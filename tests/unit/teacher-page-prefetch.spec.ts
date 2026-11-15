import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPrefetched, prefetchData, PREFETCH_FRESH_MS, takeData } from '@/views/teacher/utils/pageData'
import { setTransitionActive } from '@/views/teacher/utils/navTransition'
import { useLoad } from '@/views/teacher/utils/useLoad'

function source(key = 'k') {
  let n = 0
  const fetch = vi.fn(async () => ++n)
  return { key, fetch }
}

describe('老师端点按预取', () => {
  beforeEach(() => clearPrefetched())
  afterEach(() => {
    vi.useRealTimers()
    setTransitionActive(false)
  })

  it('按下时预取，页面加载直接用预取结果，不再发第二次请求', async () => {
    const s = source()
    prefetchData(s)
    prefetchData(s)
    expect(await takeData(s)).toBe(1)
    expect(s.fetch).toHaveBeenCalledTimes(1)
  })

  it('预取只用一次：之后的刷新拿最新数据', async () => {
    const s = source()
    await prefetchData(s)
    await takeData(s)
    expect(await takeData(s)).toBe(2)
  })

  it('过了新鲜期的预取作废', async () => {
    vi.useFakeTimers()
    const s = source()
    await prefetchData(s)
    vi.setSystemTime(Date.now() + PREFETCH_FRESH_MS + 1)
    expect(await takeData(s)).toBe(2)
  })

  it('预取失败不留下坏结果，页面加载重新请求', async () => {
    const s = { key: 'bad', fetch: vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue('ok') }
    await prefetchData(s).catch(() => {})
    expect(await takeData(s)).toBe('ok')
  })

  it('骨架屏中的页面在转场中拿到数据立即显示，不等滑完', async () => {
    const s = source()
    await prefetchData(s)
    setTransitionActive(true)
    const page = useLoad(s)
    await page.load()
    expect(page.data.value).toBe(1)
    expect(page.loading.value).toBe(false)
  })

  it('已有内容的页面在转场中先不换内容，滑完再替换', async () => {
    const page = useLoad(source())
    await page.load()
    setTransitionActive(true)
    const reloading = page.load()
    await new Promise((r) => setTimeout(r, 10))
    expect(page.data.value).toBe(1)
    setTransitionActive(false)
    await reloading
    expect(page.data.value).toBe(2)
  })
})
