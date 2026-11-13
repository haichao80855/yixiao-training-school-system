// @vitest-environment jsdom
/**
 * 老师课酬页面 (src/views/financial/teacherPay.vue) 的关键提示与按钮状态。
 * 接口用桩数据代替，页面本身是真实组件 (Element Plus 按需引入，与真实构建一致)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { TeacherPayMonth } from '@/api/modules/teacherPay'

const getMonth = vi.fn()
vi.mock('@/api/modules/teacherPay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/modules/teacherPay')>()
  return { ...actual, teacherPayApi: { ...actual.teacherPayApi, getMonth: (...args: unknown[]) => getMonth(...args) } }
})

const RULES = { dailyBase: 120, perLesson: 20, perStudent: 3, bonusThreshold: 10, bonusAmount: 20 }

function monthData(overrides: Partial<TeacherPayMonth>): TeacherPayMonth {
  return {
    campusId: 'campus-1',
    month: '2026-10',
    status: 'draft',
    rules: RULES,
    lines: [
      {
        teacherId: 't1', teacherName: '孙晨', teachingDays: 2, lessonCount: 5, attendedCount: 25, bonusDays: 1,
        baseCents: 24000, lessonCents: 10000, studentCents: 7500, bonusCents: 2000, totalCents: 43500, days: [],
      },
    ],
    summary: { teacherCount: 1, teachingDays: 2, lessonCount: 5, attendedCount: 25, totalCents: 43500 },
    monthEnded: true,
    confirmedBy: null,
    confirmedAt: null,
    liveTotalCents: null,
    lastReopenReason: null,
    lastReopenedBy: null,
    lastReopenedAt: null,
    ...overrides,
  }
}

async function mountPage(query = '?month=2026-10') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/financial/teacherPay', component: { template: '<div />' } }],
  })
  await router.push(`/financial/teacherPay${query}`)
  await router.isReady()
  const { default: TeacherPay } = await import('@/views/financial/teacherPay.vue')
  const wrapper = mount(TeacherPay, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const buttonByText = (wrapper: Awaited<ReturnType<typeof mountPage>>, text: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(text))

beforeEach(() => {
  setActivePinia(createPinia())
  getMonth.mockReset()
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('老师课酬页面', () => {
  it('按地址栏里的月份加载课酬', async () => {
    getMonth.mockResolvedValue({ success: true, data: monthData({}) })
    await mountPage('?month=2026-10')
    expect(getMonth).toHaveBeenCalledWith('2026-10')
  })

  it('显示合计金额 (分换算成元)', async () => {
    getMonth.mockResolvedValue({ success: true, data: monthData({}) })
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('435.00')
    expect(wrapper.text()).toContain('孙晨')
  })

  it('已确认后点名记录有变化：提示现在重算的金额和差额', async () => {
    getMonth.mockResolvedValue({
      success: true,
      data: monthData({ status: 'confirmed', confirmedBy: '张校长', confirmedAt: '2026-11-01T02:00:00.000Z', liveTotalCents: 43800 }),
    })
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('确认以后点名记录有变化')
    expect(text).toContain('现在重算是 ¥438.00')
    expect(text).toMatch(/比确认时\s*多\s*¥3\.00/)
    expect(buttonByText(wrapper, '撤销确认')).toBeTruthy()
  })

  it('已确认且数据没变化：不提示', async () => {
    getMonth.mockResolvedValue({ success: true, data: monthData({ status: 'confirmed', confirmedBy: '张校长', confirmedAt: '2026-11-01T02:00:00.000Z', liveTotalCents: 43500 }) })
    const wrapper = await mountPage()
    expect(wrapper.text()).not.toContain('确认以后点名记录有变化')
  })

  it('月份还没结束：「确认本月课酬」不可点，并说明月底后才能确认', async () => {
    getMonth.mockResolvedValue({ success: true, data: monthData({ monthEnded: false }) })
    const wrapper = await mountPage()
    const confirm = buttonByText(wrapper, '确认')
    expect(confirm).toBeTruthy()
    expect(confirm!.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('月底后可以确认')
  })

  it('月份已结束且未确认：可以确认', async () => {
    getMonth.mockResolvedValue({ success: true, data: monthData({ monthEnded: true }) })
    const wrapper = await mountPage()
    expect(buttonByText(wrapper, '确认')!.attributes('disabled')).toBeUndefined()
  })

  it('没有权限或加载失败：显示后端给的原因，而不是空白页面', async () => {
    getMonth.mockRejectedValue(new Error('只有校区负责人及以上可以查看老师课酬'))
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('只有校区负责人及以上可以查看老师课酬')
  })
})
