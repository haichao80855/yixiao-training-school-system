import { describe, expect, it } from 'vitest'
import { mondayOf, nextWeekday, toDateKey } from '@/utils/dateKey'
import { safeLoginRedirect } from '@/utils/loginRedirect'
import { formatLessonLabel } from '@/utils/lessonLabel'
import { formatServiceFeeCategory, formatServiceFeeStatus } from '@/utils/serviceFeeManager'

describe('dateKey：日期键与周计算', () => {
  it('toDateKey 补零，格式与后端 date 字段一致', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })

  it('toDateKey 按本地日期，不受时分影响 (00:00 和 23:59 是同一天)', () => {
    expect(toDateKey(new Date(2026, 1, 28, 0, 0))).toBe(toDateKey(new Date(2026, 1, 28, 23, 59)))
  })

  it('mondayOf：周一为一周开始，周日属于上一周', () => {
    // 2026-11-12 是周四
    expect(toDateKey(mondayOf(new Date(2026, 10, 12)))).toBe('2026-11-09')
    expect(toDateKey(mondayOf(new Date(2026, 10, 9)))).toBe('2026-11-09') // 周一本身
    expect(toDateKey(mondayOf(new Date(2026, 10, 15)))).toBe('2026-11-09') // 周日
    expect(toDateKey(mondayOf(new Date(2026, 10, 16)))).toBe('2026-11-16') // 下周一
  })

  it('mondayOf：跨月、跨年', () => {
    expect(toDateKey(mondayOf(new Date(2026, 2, 1)))).toBe('2026-02-23') // 2026-03-01 周日
    expect(toDateKey(mondayOf(new Date(2027, 0, 1)))).toBe('2026-12-28') // 2027-01-01 周五
    expect(mondayOf(new Date(2026, 10, 12, 18, 30)).getHours()).toBe(0)
  })

  it('nextWeekday：含今天在内最近的星期几', () => {
    const thu = new Date(2026, 10, 12)
    expect(toDateKey(nextWeekday(4, thu))).toBe('2026-11-12') // 今天就是周四
    expect(toDateKey(nextWeekday(6, thu))).toBe('2026-11-14') // 本周六
    expect(toDateKey(nextWeekday(1, thu))).toBe('2026-11-16') // 下周一
    expect(toDateKey(nextWeekday(0, thu))).toBe('2026-11-15') // 周日
  })
})

describe('loginRedirect：登录后回跳只接受站内地址', () => {
  it('站内相对路径原样放行 (含查询参数)', () => {
    expect(safeLoginRedirect('/financial/orderManagement')).toBe('/financial/orderManagement')
    expect(safeLoginRedirect('/financial/teacherPay?month=2026-10')).toBe('/financial/teacherPay?month=2026-10')
  })

  it('外部地址、协议相对地址、反斜杠绕过一律拒绝', () => {
    expect(safeLoginRedirect('https://evil.example.com')).toBeNull()
    expect(safeLoginRedirect('//evil.example.com')).toBeNull()
    expect(safeLoginRedirect('/\\evil.example.com')).toBeNull()
    expect(safeLoginRedirect('javascript:alert(1)')).toBeNull()
  })

  it('回跳到登录页本身会造成循环，拒绝', () => {
    expect(safeLoginRedirect('/login')).toBeNull()
    expect(safeLoginRedirect('/login?redirect=/x')).toBeNull()
  })

  it('路由 query 可能是数组或空值：取第一个，空值拒绝', () => {
    expect(safeLoginRedirect(['/dashboard', '/x'])).toBe('/dashboard')
    expect(safeLoginRedirect(undefined)).toBeNull()
    expect(safeLoginRedirect(null)).toBeNull()
    expect(safeLoginRedirect(123)).toBeNull()
  })
})

describe('lessonLabel：课次展示名', () => {
  it('有序号时为「班级-第N讲」', () => {
    expect(formatLessonLabel({ className: 'Scratch 周六班', lessonNumber: 3 })).toBe('Scratch 周六班-第3讲')
  })

  it('没有序号时退回班级名称；空值返回空串', () => {
    expect(formatLessonLabel({ className: 'Scratch 周六班' })).toBe('Scratch 周六班')
    expect(formatLessonLabel({ className: 'Scratch 周六班', lessonNumber: 0 })).toBe('Scratch 周六班')
    expect(formatLessonLabel(null)).toBe('')
    expect(formatLessonLabel(undefined)).toBe('')
  })
})

describe('serviceFeeManager：服务费类别与核销状态', () => {
  it('已知类别和状态显示中文', () => {
    expect(formatServiceFeeCategory('certification')).toBe('等级认证与考级')
    expect(formatServiceFeeCategory('competition')).toBe('白名单与青少科创赛事')
    expect(formatServiceFeeStatus('pending')).toEqual({ label: '待核销', type: 'warning' })
    expect(formatServiceFeeStatus('verified')).toEqual({ label: '已核销', type: 'success' })
  })

  it('未知类别原样显示，空类别显示「其他考务」；未知状态显示原值', () => {
    expect(formatServiceFeeCategory('olympiad')).toBe('olympiad')
    expect(formatServiceFeeCategory('')).toBe('其他考务')
    expect(formatServiceFeeStatus('cancelled')).toEqual({ label: 'cancelled', type: 'info' })
  })
})
