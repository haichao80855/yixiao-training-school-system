// @vitest-environment jsdom
/**
 * 请求层与列表加载 (流畅度改进第 3 期)：
 * - request()：请求卡住时按超时报错，不会一直转圈；
 * - useLoadState：连续加载时 isLatest() 只对最后一次为真，旧结果不会覆盖新结果；
 * - useDebouncedRef：停止输入后才更新，清空时立即更新。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { request, RequestTimeoutError } from '@/utils/request'
import { useLoadState } from '@/composables/useLoadState'
import { useDebouncedRef } from '@/composables/useDebouncedRef'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('request 超时', () => {
  it('超过 timeoutMs 没有响应时抛出 RequestTimeoutError', async () => {
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
    )
    await expect(request('/api/slow', { timeoutMs: 20 })).rejects.toBeInstanceOf(RequestTimeoutError)
  })

  it('正常返回时不受超时影响', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ data: { ok: 1 } }), { status: 200 }))
    await expect(request('/api/fast', { timeoutMs: 1000 })).resolves.toMatchObject({ success: true, data: { ok: 1 } })
  })

  it('调用方传入的 signal 取消后请求也会取消，且不当成超时', async () => {
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
    )
    const controller = new AbortController()
    const pending = request('/api/cancel', { signal: controller.signal, timeoutMs: 1000 })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('useLoadState', () => {
  it('只有最后一次加载的 isLatest() 为真', async () => {
    const { track, loading } = useLoadState()
    const seen: string[] = []
    let releaseFirst!: () => void
    const first = track(async (isLatest) => {
      await new Promise<void>((r) => { releaseFirst = r })
      if (isLatest()) seen.push('first')
    })
    const second = track(async (isLatest) => {
      if (isLatest()) seen.push('second')
    })
    await second
    releaseFirst()
    await first
    expect(seen).toEqual(['second'])
    expect(loading.value).toBe(false)
  })

  it('超时错误显示为可重试的提示', async () => {
    const { track, loadError } = useLoadState()
    await track(async () => {
      throw new RequestTimeoutError()
    })
    expect(loadError.value).toContain('超时')
  })
})

describe('useDebouncedRef', () => {
  it('停止输入 300ms 后才更新，清空时立即更新', async () => {
    vi.useFakeTimers()
    const scope = effectScope()
    const source = ref('')
    const debounced = scope.run(() => useDebouncedRef(source, 300))!
    source.value = '张'
    await nextTick()
    source.value = '张三'
    await nextTick()
    expect(debounced.value).toBe('')
    vi.advanceTimersByTime(299)
    expect(debounced.value).toBe('')
    vi.advanceTimersByTime(1)
    expect(debounced.value).toBe('张三')
    source.value = ''
    await nextTick()
    expect(debounced.value).toBe('')
    scope.stop()
  })
})
