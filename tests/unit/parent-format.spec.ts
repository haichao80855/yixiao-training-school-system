/**
 * 家长端统一格式 (mini-program/src/package-parent/utils/format.ts，家长端 UI 改进第 2 期)。
 */
import { describe, expect, it } from 'vitest'
import {
  formatDateCn,
  formatLongDate,
  formatMonthCn,
  formatFullDateCn,
  formatHours,
  relativeDayLabel,
  teacherTitle,
} from '../../mini-program/src/package-parent/utils/format'

describe('家长端日期格式', () => {
  it('日期统一写成「10月12日 周一」，页面顶部的今天也一样 (不再写「星期一」)', () => {
    expect(formatDateCn('2026-10-12')).toBe('10月12日 周一')
    expect(formatLongDate('2026-10-12')).toBe('10月12日 周一')
  })
  it('月份写成「2026年10月」，接受 YYYY-MM 和完整日期', () => {
    expect(formatMonthCn('2026-10')).toBe('2026年10月')
    expect(formatMonthCn('2026-03-05')).toBe('2026年3月')
    expect(formatMonthCn('')).toBe('')
  })
  it('完整日期写到日 (课包有效期以前只写到月)', () => {
    expect(formatFullDateCn('2027-05-31')).toBe('2027年5月31日')
    expect(formatFullDateCn(new Date(2026, 0, 2))).toBe('2026年1月2日')
    expect(formatFullDateCn(null)).toBe('')
  })
})

describe('课时与文案', () => {
  it('课时最多 1 位小数，不出现浮点误差', () => {
    expect(formatHours(0.1 + 0.2)).toBe('0.3')
    expect(formatHours(3)).toBe('3')
    expect(formatHours(1.25)).toBe('1.3')
    expect(formatHours(undefined)).toBe('0')
  })
  it('倒计时：今天、明天、后天，之后写天数', () => {
    expect([0, 1, 2, 5].map(relativeDayLabel)).toEqual(['今天', '明天', '后天', '5 天后'])
  })
  it('老师称呼带「老师」，不重复加', () => {
    expect(teacherTitle('李明')).toBe('李明老师')
    expect(teacherTitle('王老师')).toBe('王老师')
    expect(teacherTitle(null)).toBe('老师')
  })
})
