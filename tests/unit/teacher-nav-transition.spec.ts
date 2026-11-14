import { afterEach, describe, expect, it, vi } from 'vitest'
import { isTransitionActive, setTransitionActive, whenTransitionIdle } from '@/views/teacher/utils/navTransition'

describe('老师端转场闸门', () => {
  afterEach(() => {
    setTransitionActive(false)
    vi.useRealTimers()
  })

  it('没有转场时立即放行', async () => {
    let done = false
    await whenTransitionIdle().then(() => (done = true))
    expect(done).toBe(true)
  })

  it('转场进行中拿到的数据，等转场结束再提交', async () => {
    setTransitionActive(true)
    let done = false
    const waiting = whenTransitionIdle().then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)
    setTransitionActive(false)
    await waiting
    expect(done).toBe(true)
    expect(isTransitionActive()).toBe(false)
  })

  it('转场意外没有结束时最多等 700ms，页面不会一直停在骨架屏', async () => {
    vi.useFakeTimers()
    setTransitionActive(true)
    let done = false
    whenTransitionIdle().then(() => (done = true))
    await vi.advanceTimersByTimeAsync(699)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
  })
})
