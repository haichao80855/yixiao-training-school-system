import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/** 业务时区：日期分桶统一按北京时间，避免服务器时区不同导致跨天错位 */
const BUSINESS_TIME_ZONE = 'Asia/Shanghai';
const DAY_HOURS = { first: 8, last: 21 };
const MAX_DAILY_BUCKET_SPAN = 31;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface TrendPoint {
  label: string;
  value: number;
}

export interface AdminDashboardQuery {
  campusId?: string;
  consumptionStart: string;
  consumptionEnd: string;
  enrollmentStart: string;
  enrollmentEnd: string;
}

/** 招生口径：已缴费的课程订单 (新签 / 续费 / 季度续费) */
const ENROLLMENT_ORDER_TYPES = ['regular', 'quarterly'];

/** DateTime → 北京时间 { date: 'YYYY-MM-DD', hour } */
export function toBusinessDateParts(d: Date): { date: string; hour: number } {
  // sv-SE 输出 "YYYY-MM-DD HH:mm:ss"
  const s = d.toLocaleString('sv-SE', { timeZone: BUSINESS_TIME_ZONE, hour12: false });
  return { date: s.slice(0, 10), hour: Number(s.slice(11, 13)) };
}

/** 北京时间日期字符串的当日 0 点 (UTC 瞬时值) */
function businessDayStart(date: string): Date {
  return new Date(`${date}T00:00:00+08:00`);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daySpan(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
}

export type BucketGranularity = 'hour' | 'day' | 'month';

/**
 * 根据统计区间生成趋势分桶：单日按小时 (08~21 点)，31 天内按天，更长按月。
 * 返回有序的 { key, label }，key 用于把记录归入对应桶。
 */
export function buildTrendBuckets(start: string, end: string): {
  granularity: BucketGranularity;
  buckets: Array<{ key: string; label: string }>;
} {
  if (start === end) {
    const buckets = [];
    for (let h = DAY_HOURS.first; h <= DAY_HOURS.last; h++) {
      const hh = String(h).padStart(2, '0');
      buckets.push({ key: hh, label: `${hh}:00` });
    }
    return { granularity: 'hour', buckets };
  }
  if (daySpan(start, end) <= MAX_DAILY_BUCKET_SPAN) {
    const buckets = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      buckets.push({ key: d, label: d.slice(5) });
    }
    return { granularity: 'day', buckets };
  }
  const buckets = [];
  let [y, m] = start.slice(0, 7).split('-').map(Number);
  const endMonth = end.slice(0, 7);
  for (;;) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    if (ym > endMonth) break;
    buckets.push({ key: ym, label: `${String(m).padStart(2, '0')}月` });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return { granularity: 'month', buckets };
}

/** 计算记录所属分桶 key；单日小时桶把营业时间外的记录并入首/末桶 */
export function bucketKeyOf(granularity: BucketGranularity, date: string, hour = 0): string {
  if (granularity === 'month') return date.slice(0, 7);
  if (granularity === 'day') return date;
  const h = Math.min(DAY_HOURS.last, Math.max(DAY_HOURS.first, hour));
  return String(h).padStart(2, '0');
}

function toTrend(
  buckets: Array<{ key: string; label: string }>,
  totals: Map<string, number>,
  digits = 0,
): TrendPoint[] {
  const factor = 10 ** digits;
  return buckets.map((b) => ({
    label: b.label,
    value: Math.round((totals.get(b.key) || 0) * factor) / factor,
  }));
}

function assertDate(value: string, name: string) {
  if (!DATE_RE.test(value || '')) {
    throw new BadRequestException(`${name} 须为 YYYY-MM-DD 格式`);
  }
}

/**
 * 管理员首页看板聚合：课耗金额 / 招生人数的真实汇总与按时间分桶的趋势点列。
 * 取代小程序端按固定权重伪造趋势、按倍数伪造漏斗的做法。
 */
@Injectable()
export class AdminDashboardAggregator {
  constructor(private readonly prisma: PrismaService) {}

  async aggregate(query: AdminDashboardQuery) {
    assertDate(query.consumptionStart, 'consumptionStart');
    assertDate(query.consumptionEnd, 'consumptionEnd');
    assertDate(query.enrollmentStart, 'enrollmentStart');
    assertDate(query.enrollmentEnd, 'enrollmentEnd');
    const campusId = query.campusId && query.campusId !== 'all' ? query.campusId : undefined;

    const [consumption, enrollment] = await Promise.all([
      this.aggregateConsumption(campusId, query.consumptionStart, query.consumptionEnd),
      this.aggregateEnrollment(campusId, query.enrollmentStart, query.enrollmentEnd),
    ]);
    return { consumption, enrollment };
  }

  /** 课耗：区间内未冲正考勤的实扣课时 × 课包单价 (无单价时回退课程标准单价) */
  private async aggregateConsumption(campusId: string | undefined, start: string, end: string) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        isReversed: false,
        deductLessons: { gt: 0 },
        scheduleEvent: {
          date: start === end ? start : { gte: start, lte: end },
          ...(campusId ? { campusId } : {}),
        },
      },
      select: {
        deductLessons: true,
        package: { select: { pricePerLesson: true, course: { select: { attribute: true, pricePerLesson: true } } } },
        scheduleEvent: {
          select: {
            date: true,
            startTime: true,
            class: { select: { course: { select: { attribute: true, pricePerLesson: true } } } },
          },
        },
      },
    });

    const { granularity, buckets } = buildTrendBuckets(start, end);
    const totals = new Map<string, number>();
    let amountCents = 0;
    let regularCents = 0;
    let expandCents = 0;
    let otherCents = 0;
    let lessons = 0;

    for (const r of records) {
      const course = r.package?.course || r.scheduleEvent?.class?.course;
      const price = r.package?.pricePerLesson || course?.pricePerLesson || 0;
      const cents = Math.round(r.deductLessons * price * 100);
      lessons += r.deductLessons;
      amountCents += cents;
      if (course?.attribute === 'regular') regularCents += cents;
      else if (course?.attribute === 'extended') expandCents += cents;
      else otherCents += cents;

      const hour = Number((r.scheduleEvent?.startTime || '00').slice(0, 2));
      const key = bucketKeyOf(granularity, r.scheduleEvent.date, hour);
      totals.set(key, (totals.get(key) || 0) + cents / 100);
    }

    return {
      amount: amountCents / 100,
      regularAmount: regularCents / 100,
      expandAmount: expandCents / 100,
      otherAmount: otherCents / 100,
      lessonCount: lessons,
      trend: toTrend(buckets, totals, 2),
    };
  }

  /**
   * 招生：区间内已缴费课程订单涉及的去重学员数。
   * 新签 = 该学员此前没有任何已缴费课程订单；其余为续费。常规课 / 扩科按订单课包的课程属性区分。
   */
  private async aggregateEnrollment(campusId: string | undefined, start: string, end: string) {
    const rangeStart = businessDayStart(start);
    const rangeEnd = businessDayStart(addDays(end, 1));
    const orders = await this.prisma.order.findMany({
      where: {
        status: 'paid',
        orderType: { in: ENROLLMENT_ORDER_TYPES },
        createdAt: { gte: rangeStart, lt: rangeEnd },
        ...(campusId ? { campusId } : {}),
      },
      select: {
        studentId: true,
        createdAt: true,
        package: { select: { course: { select: { attribute: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const studentIds = [...new Set(orders.map((o) => o.studentId))];
    const earlier = studentIds.length
      ? await this.prisma.order.findMany({
          where: {
            status: 'paid',
            orderType: { in: ENROLLMENT_ORDER_TYPES },
            createdAt: { lt: rangeStart },
            studentId: { in: studentIds },
          },
          select: { studentId: true },
          distinct: ['studentId'],
        })
      : [];
    const returning = new Set(earlier.map((o) => o.studentId));

    const { granularity, buckets } = buildTrendBuckets(start, end);
    const seenInBucket = new Map<string, Set<string>>();
    const regular = new Set<string>();
    const expand = new Set<string>();
    const all = new Set<string>();

    for (const o of orders) {
      all.add(o.studentId);
      if (o.package?.course?.attribute === 'regular' || !o.package) regular.add(o.studentId);
      else expand.add(o.studentId);

      const { date, hour } = toBusinessDateParts(o.createdAt);
      const key = bucketKeyOf(granularity, date, hour);
      if (!seenInBucket.has(key)) seenInBucket.set(key, new Set());
      seenInBucket.get(key)!.add(o.studentId);
    }

    const totals = new Map<string, number>();
    for (const [key, ids] of seenInBucket) totals.set(key, ids.size);
    const renewalCount = studentIds.filter((id) => returning.has(id)).length;

    return {
      studentCount: all.size,
      newCount: all.size - renewalCount,
      renewalCount,
      regularCount: regular.size,
      expandCount: expand.size,
      trend: toTrend(buckets, totals),
    };
  }
}
