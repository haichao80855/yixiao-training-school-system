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

/** 2026-10-22 → 10月22日 星期四 */
export function formatLongDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = ['日', '一', '二', '三', '四', '五', '六'][new Date(y, m - 1, d).getDay()];
  return `${m}月${d}日 星期${wd}`;
}

/** 与今天相差的天数 (正数为将来) */
export function daysFromToday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}
