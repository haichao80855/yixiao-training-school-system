/** 本地时区的日期键，如 2026-11-12 (与后端排课、订单的 date 字段同一格式) */
export function toDateKey(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 所在周的周一 0 点 (周一为一周开始) */
export function mondayOf(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/** 从今天起 (含今天) 最近的星期几，weekday 与 Date#getDay 一致：0 = 周日，6 = 周六 */
export function nextWeekday(weekday: number, from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7))
  return d
}
