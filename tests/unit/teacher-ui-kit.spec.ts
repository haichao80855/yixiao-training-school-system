import { afterEach, describe, expect, it, vi } from 'vitest'
import { AVATAR_TONES, avatarText, avatarTone } from '@/views/teacher/utils/avatar'
import { feedbackState, settleConfirm, tpAlert, tpConfirm, tpToast } from '@/views/teacher/utils/feedback'

describe('老师端文字头像', () => {
  it('三个字及以上取后两个字，两个字原样显示', () => {
    expect(avatarText('欧阳子涵')).toBe('子涵')
    expect(avatarText('王小明')).toBe('小明')
    expect(avatarText('张一')).toBe('张一')
    expect(avatarText('  ')).toBe('')
    expect(avatarText(undefined)).toBe('')
  })

  it('同一个 ID 每次颜色相同，且在 1 到 6 档之内', () => {
    const ids = ['82e66174-82e9-425f-933f-ff62e89f0cf8', 'a5bc3b98', 'x', '']
    for (const id of ids) {
      const tone = avatarTone(id)
      expect(tone).toBe(avatarTone(id))
      expect(tone).toBeGreaterThanOrEqual(1)
      expect(tone).toBeLessThanOrEqual(AVATAR_TONES)
    }
  })
})

describe('老师端确认框与轻提示', () => {
  afterEach(() => {
    settleConfirm(false)
    feedbackState.hostMounted = false
    feedbackState.toast = null
    vi.useRealTimers()
  })

  it('确认返回 true，取消返回 false', async () => {
    feedbackState.hostMounted = true
    const yes = tpConfirm({ title: '退出登录', message: '确定？' })
    expect(feedbackState.confirm?.title).toBe('退出登录')
    settleConfirm(true)
    await expect(yes).resolves.toBe(true)

    const no = tpConfirm({ title: '放弃修改？', message: '会丢失', danger: true })
    expect(feedbackState.confirm?.danger).toBe(true)
    settleConfirm(false)
    await expect(no).resolves.toBe(false)
    expect(feedbackState.confirm).toBeNull()
  })

  it('同时只显示一个确认框：新的出现时，旧的按取消结束', async () => {
    feedbackState.hostMounted = true
    const first = tpConfirm({ title: '一', message: '' })
    const second = tpConfirm({ title: '二', message: '' })
    await expect(first).resolves.toBe(false)
    expect(feedbackState.confirm?.title).toBe('二')
    settleConfirm(true)
    await expect(second).resolves.toBe(true)
  })

  it('提示框只有一个按钮，点了就结束', async () => {
    feedbackState.hostMounted = true
    const done = tpAlert({ title: '部分课评未推送', message: '未推送：张一' })
    expect(feedbackState.confirm?.alert).toBe(true)
    settleConfirm(true)
    await expect(done).resolves.toBeUndefined()
  })

  it('布局还没挂载时退回浏览器自带确认框，不会卡住', async () => {
    const confirm = vi.fn().mockReturnValue(true)
    vi.stubGlobal('window', { confirm })
    await expect(tpConfirm({ title: 'T', message: 'M' })).resolves.toBe(true)
    expect(confirm).toHaveBeenCalledWith('T\nM')
    vi.unstubAllGlobals()
  })

  it('成功提示 2 秒后消失，出错提示停留更久', () => {
    vi.useFakeTimers()
    tpToast.success('已推送')
    expect(feedbackState.toast?.message).toBe('已推送')
    vi.advanceTimersByTime(2000)
    expect(feedbackState.toast).toBeNull()

    tpToast.error('提交失败')
    vi.advanceTimersByTime(2000)
    expect(feedbackState.toast?.type).toBe('error')
    vi.advanceTimersByTime(1500)
    expect(feedbackState.toast).toBeNull()
  })
})
