/**
 * 班级排课概况投影：上课规律、课次进度与末次课日期均由真实排课记录推导，不单独落库。
 * 只统计未取消的正式课，补课与试听课不计入班级进度和规律。
 */
export interface ClassScheduleRow {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: string;
  classType: string;
}

export interface ClassScheduleSummary {
  scheduleDesc: string; // 无排课时为空字符串
  completedLessons: number;
  lastScheduleDate: string | null;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MAX_PATTERNS_SHOWN = 2;

export function summarizeClassSchedules(rows: ClassScheduleRow[]): ClassScheduleSummary {
  const lessons = rows.filter((r) => r.classType === 'formal' && r.status !== 'cancelled');

  // 按“星期 + 时段”聚合，出现次数多的排在前面；次数相同时按首次出现顺序，保证结果稳定
  const patternCounts = new Map<string, number>();
  for (const { date, startTime, endTime } of [...lessons].sort((a, b) => a.date.localeCompare(b.date))) {
    const weekday = WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()];
    const pattern = `每${weekday} ${startTime}-${endTime}`;
    patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
  }
  const patterns = [...patternCounts.entries()].sort((a, b) => b[1] - a[1]).map(([pattern]) => pattern);
  const shown = patterns.slice(0, MAX_PATTERNS_SHOWN).join('、');

  return {
    scheduleDesc: patterns.length > MAX_PATTERNS_SHOWN ? `${shown} 等` : shown,
    completedLessons: lessons.filter((r) => r.status === 'completed').length,
    lastScheduleDate: lessons.reduce<string | null>(
      (latest, r) => (latest === null || r.date > latest ? r.date : latest),
      null,
    ),
  };
}
