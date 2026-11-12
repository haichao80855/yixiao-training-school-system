import { request } from '@/utils/request'

/** 课酬规则，单位：元 (奖励门槛单位：人次) */
export interface TeacherPayRules {
  dailyBase: number
  perLesson: number
  perStudent: number
  bonusThreshold: number
  bonusAmount: number
}

export interface PayDayLesson {
  scheduleEventId: string
  startTime: string
  endTime: string
  className: string
  lessonTitle: string
  attendedCount: number
}

export interface PayDay {
  date: string
  lessons: PayDayLesson[]
  lessonCount: number
  attendedCount: number
  bonusReached: boolean
  baseCents: number
  lessonCents: number
  studentCents: number
  bonusCents: number
  totalCents: number
}

export interface TeacherPayLine {
  teacherId: string
  teacherName: string
  teachingDays: number
  lessonCount: number
  attendedCount: number
  bonusDays: number
  baseCents: number
  lessonCents: number
  studentCents: number
  bonusCents: number
  totalCents: number
  days: PayDay[]
}

export interface TeacherPayMonth {
  campusId: string
  month: string
  /** draft = 未确认 (实时计算)；confirmed = 已确认 (确认时的快照) */
  status: 'draft' | 'confirmed'
  rules: TeacherPayRules
  lines: TeacherPayLine[]
  summary: { teacherCount: number; teachingDays: number; lessonCount: number; attendedCount: number; totalCents: number }
  monthEnded: boolean
  confirmedBy: string | null
  confirmedAt: string | null
  /** 已确认时按现在的数据重算的合计 */
  liveTotalCents: number | null
  lastReopenReason: string | null
  lastReopenedBy: string | null
  lastReopenedAt: string | null
}

/** 老师课酬 (只有校区负责人及以上能调用) */
export const teacherPayApi = {
  getMonth: (month: string) => request<TeacherPayMonth>('/api/financial/teacher-pay', { params: { month } }),
  confirm: (month: string) =>
    request<TeacherPayMonth>('/api/financial/teacher-pay/confirm', { method: 'POST', body: JSON.stringify({ month }) }),
  reopen: (month: string, reason: string) =>
    request<TeacherPayMonth>('/api/financial/teacher-pay/reopen', { method: 'POST', body: JSON.stringify({ month, reason }) }),
  saveRules: (rules: TeacherPayRules) =>
    request<TeacherPayRules>('/api/financial/teacher-pay/rules', { method: 'PUT', body: JSON.stringify(rules) }),
}

/** 分 → 元的显示文本，如 35900 → "359.00" */
export function formatYuan(cents: number): string {
  return (cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
