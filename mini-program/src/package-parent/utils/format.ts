const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 2026-10-12 → 10月12日 周一 */
export function formatDateCn(date: string | null | undefined, withWeekday = true): string {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return withWeekday ? `${m}月${d}日 ${wd}` : `${m}月${d}日`;
}

/** 本地日期 YYYY-MM-DD */
export function todayIso(): string {
  const now = new Date();
  return toIso(now);
}

export function toIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return toIso(new Date(y, m - 1, d + days));
}

/** 周一为一周起点 */
export function weekStartIso(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const offset = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return addDaysIso(date, -offset);
}

export const ATTENDANCE_LABEL: Record<string, string> = {
  present: '已出勤',
  late: '迟到',
  leave: '请假',
  absent: '缺勤',
  upcoming: '待上课',
  cancelled: '已取消',
  not_recorded: '待点名',
};

/** 页面顶部的今天：和其他地方统一写法「10月22日 周四」(以前这里单独写成「星期四」) */
export function formatLongDate(date: string): string {
  return formatDateCn(date, true);
}

/* ---- 家长端统一格式 (家长端 UI 改进第 2 期)：页面里不要再各自拼日期 ---- */

/** 2026-10 或 2026-10-12 → 2026年10月 */
export function formatMonthCn(value: string | null | undefined): string {
  if (!value) return '';
  const [y, m] = value.split('-').map(Number);
  if (!y || !m) return value;
  return `${y}年${m}月`;
}

/** 2026-10-12、ISO 时间或 Date → 2026年10月12日 (按本地时间) */
export function formatFullDateCn(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return `${y}年${m}月${d}日`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 课时：最多保留 1 位小数，去掉多余的 0 (避免 0.1 + 0.2 显示成 0.30000000000000004) */
export function formatHours(value: number | null | undefined): string {
  const n = Math.round((Number(value) || 0) * 10) / 10;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** 距今天的天数 → 今天 / 明天 / 后天 / N 天后 */
export function relativeDayLabel(days: number): string {
  if (days <= 0) return '今天';
  if (days === 1) return '明天';
  if (days === 2) return '后天';
  return `${days} 天后`;
}

/** 老师称呼：李明 → 李明老师 (已经带「老师」的不重复加；没有名字时只写「老师」) */
export function teacherTitle(name: string | null | undefined): string {
  const n = (name || '').trim();
  if (!n) return '老师';
  return n.endsWith('老师') ? n : `${n}老师`;
}

/** 与今天相差的天数 (正数为将来) */
export function daysFromToday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}
