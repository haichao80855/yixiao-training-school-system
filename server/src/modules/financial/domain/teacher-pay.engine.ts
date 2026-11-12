/**
 * 老师课酬计算 (纯函数，不查数据库)
 *
 * 按老师、按天计算，金额一律用整数「分」：
 * - 基础工资：当天至少上了 1 节计酬课，计 dailyBase
 * - 课时费：每节计酬课 perLesson
 * - 人次费：每节课到课 (出勤 + 迟到) 每人次 perStudent
 * - 奖励：当天到课人次合计 ≥ bonusThreshold，计 bonusAmount (同一学员上 2 节算 2 人次)
 *
 * 哪些课算「计酬课」由调用方筛好 (正式课、已点名、未取消)，这里只负责算钱。
 */

/** 课酬规则，单位：元 (人数阈值单位：人次) */
export interface TeacherPayRules {
  dailyBase: number;
  perLesson: number;
  perStudent: number;
  bonusThreshold: number;
  bonusAmount: number;
}

export const DEFAULT_TEACHER_PAY_RULES: TeacherPayRules = {
  dailyBase: 120,
  perLesson: 20,
  perStudent: 3,
  bonusThreshold: 10,
  bonusAmount: 20,
};

const RULE_KEYS: Array<keyof TeacherPayRules> = ['dailyBase', 'perLesson', 'perStudent', 'bonusThreshold', 'bonusAmount'];

/** 校验并规整规则：每项必须是 0~100000 的数，金额最多两位小数，人数阈值为整数 */
export function normalizeRules(input: any): TeacherPayRules {
  const out = {} as TeacherPayRules;
  for (const key of RULE_KEYS) {
    const raw = input?.[key];
    const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000) {
      throw new Error(`规则「${RULE_LABELS[key]}」应为 0 到 100000 之间的数字`);
    }
    if (key === 'bonusThreshold' ? !Number.isInteger(value) : Math.abs(Math.round(value * 100) - value * 100) > 1e-6) {
      throw new Error(key === 'bonusThreshold' ? '奖励人次门槛应为整数' : `规则「${RULE_LABELS[key]}」最多保留两位小数`);
    }
    out[key] = value;
  }
  return out;
}

export const RULE_LABELS: Record<keyof TeacherPayRules, string> = {
  dailyBase: '每天基础工资',
  perLesson: '每节课时费',
  perStudent: '每人次费用',
  bonusThreshold: '奖励人次门槛',
  bonusAmount: '达标奖励',
};

const toCents = (yuan: number) => Math.round(yuan * 100);

/** 一节计酬课 */
export interface PayLesson {
  scheduleEventId: string;
  teacherId: string;
  teacherName: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  className: string;
  lessonTitle: string;
  /** 到课人次 (出勤 + 迟到) */
  attendedCount: number;
}

export interface PayDay {
  date: string;
  lessons: Array<Pick<PayLesson, 'scheduleEventId' | 'startTime' | 'endTime' | 'className' | 'lessonTitle' | 'attendedCount'>>;
  lessonCount: number;
  attendedCount: number;
  bonusReached: boolean;
  baseCents: number;
  lessonCents: number;
  studentCents: number;
  bonusCents: number;
  totalCents: number;
}

export interface TeacherPayLine {
  teacherId: string;
  teacherName: string;
  teachingDays: number;
  lessonCount: number;
  attendedCount: number;
  bonusDays: number;
  baseCents: number;
  lessonCents: number;
  studentCents: number;
  bonusCents: number;
  totalCents: number;
  days: PayDay[];
}

export interface TeacherPaySummary {
  teacherCount: number;
  teachingDays: number;
  lessonCount: number;
  attendedCount: number;
  totalCents: number;
}

export function computeTeacherPay(
  lessons: PayLesson[],
  rules: TeacherPayRules,
): { lines: TeacherPayLine[]; summary: TeacherPaySummary } {
  const byTeacher = new Map<string, { name: string; days: Map<string, PayLesson[]> }>();
  for (const lesson of lessons) {
    let t = byTeacher.get(lesson.teacherId);
    if (!t) {
      t = { name: lesson.teacherName, days: new Map() };
      byTeacher.set(lesson.teacherId, t);
    }
    const list = t.days.get(lesson.date) || [];
    list.push(lesson);
    t.days.set(lesson.date, list);
  }

  const lines: TeacherPayLine[] = [];
  for (const [teacherId, t] of byTeacher) {
    const days: PayDay[] = Array.from(t.days.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayLessons]) => {
        const sorted = [...dayLessons].sort((a, b) => a.startTime.localeCompare(b.startTime));
        const attended = sorted.reduce((s, l) => s + Math.max(0, l.attendedCount), 0);
        const bonusReached = attended >= rules.bonusThreshold;
        const baseCents = sorted.length > 0 ? toCents(rules.dailyBase) : 0;
        const lessonCents = sorted.length * toCents(rules.perLesson);
        const studentCents = attended * toCents(rules.perStudent);
        const bonusCents = bonusReached ? toCents(rules.bonusAmount) : 0;
        return {
          date,
          lessons: sorted.map(({ scheduleEventId, startTime, endTime, className, lessonTitle, attendedCount }) => ({
            scheduleEventId,
            startTime,
            endTime,
            className,
            lessonTitle,
            attendedCount,
          })),
          lessonCount: sorted.length,
          attendedCount: attended,
          bonusReached,
          baseCents,
          lessonCents,
          studentCents,
          bonusCents,
          totalCents: baseCents + lessonCents + studentCents + bonusCents,
        };
      });

    const sum = (pick: (d: PayDay) => number) => days.reduce((s, d) => s + pick(d), 0);
    lines.push({
      teacherId,
      teacherName: t.name,
      teachingDays: days.length,
      lessonCount: sum((d) => d.lessonCount),
      attendedCount: sum((d) => d.attendedCount),
      bonusDays: days.filter((d) => d.bonusReached).length,
      baseCents: sum((d) => d.baseCents),
      lessonCents: sum((d) => d.lessonCents),
      studentCents: sum((d) => d.studentCents),
      bonusCents: sum((d) => d.bonusCents),
      totalCents: sum((d) => d.totalCents),
      days,
    });
  }

  // 合计高的在前，同额按姓名
  lines.sort((a, b) => b.totalCents - a.totalCents || a.teacherName.localeCompare(b.teacherName, 'zh-CN'));

  return {
    lines,
    summary: {
      teacherCount: lines.length,
      teachingDays: lines.reduce((s, l) => s + l.teachingDays, 0),
      lessonCount: lines.reduce((s, l) => s + l.lessonCount, 0),
      attendedCount: lines.reduce((s, l) => s + l.attendedCount, 0),
      totalCents: lines.reduce((s, l) => s + l.totalCents, 0),
    },
  };
}

/** YYYY-MM 月份的首日和末日 (YYYY-MM-DD) */
export function monthRange(month: string): { start: string; end: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) {
    throw new Error('月份格式应为 YYYY-MM');
  }
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` };
}
