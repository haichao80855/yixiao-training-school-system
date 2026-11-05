import type { AttendanceStatus, LessonStatus } from '@/api';

export const ATTENDANCE_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: 'present', label: '到课' },
  { value: 'late', label: '迟到' },
  { value: 'leave', label: '请假' },
  { value: 'absent', label: '缺勤' },
];

export function attendanceLabel(status: string): string {
  return ATTENDANCE_OPTIONS.find((o) => o.value === status)?.label || '未记录';
}

export function isAttended(status: string): boolean {
  return status === 'present' || status === 'late';
}

export function lessonStatusLabel(status: LessonStatus | string): string {
  const map: Record<string, string> = {
    scheduled: '未上',
    in_progress: '上课中',
    completed: '已结课',
    cancelled: '已取消',
  };
  return map[status] || status;
}

export function classStatusLabel(status: string): string {
  const map: Record<string, string> = { recruiting: '招生中', in_progress: '进行中', completed: '已结班' };
  return map[status] || status;
}

export function classTypeLabel(type: string): string {
  const map: Record<string, string> = { formal: '正式课', make_up: '补课', trial: '试听课' };
  return map[type] || '正式课';
}

export function studentStatusLabel(status: string): string {
  const map: Record<string, string> = { normal: '在读', suspended: '停课', transferred: '已转校', dropped_out: '已退学' };
  return map[status] || status;
}

export function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1, 12);
}

export function shiftDays(s: string, days: number): string {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + days);
  return formatDateStr(d);
}

export function todayStr(): string {
  return formatDateStr(new Date());
}

const WEEK_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

/** 11月5日 周四 */
export function friendlyDate(s: string): string {
  const d = parseDateStr(s);
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK_NAMES[d.getDay()]}`;
}

export function dateOnly(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

export function shortTime(t: string): string {
  return t ? t.slice(0, 5) : '';
}

/** 课次大纲可能是 Web 端富文本：编辑与展示统一转成纯文本，不渲染 HTML */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  if (!/<[a-z!/][^>]*>/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(
    html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h[1-6])>/gi, '$&\n'),
    'text/html',
  );
  return (doc.body.textContent || '').replace(/\n{2,}/g, '\n').trim();
}
