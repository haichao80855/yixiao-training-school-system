import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** 仍在招生或上课中的班级才计入满班率 */
const ACTIVE_CLASS_STATUSES = ['recruiting', 'in_progress'];

export interface TeachingMetricsQuery {
  campusId?: string;
  start: string;
  end: string;
}

/** 一项比率指标：分子、分母都返回，页面上可以写清"x / y"，不只给一个百分比 */
export interface RatioMetric {
  numerator: number;
  denominator: number;
  /** 0~100，保留 1 位小数；分母为 0 时为 null (页面显示"暂无数据"，不显示 0%) */
  rate: number | null;
}

export interface TeachingMetrics {
  start: string;
  end: string;
  /** 统计区间内已点名的课次数 */
  lessonCount: number;
  /** 到课率 = (出勤 + 迟到) / 点名记录总数 */
  attendance: RatioMetric;
  /** 请假率 = 请假 / 点名记录总数 */
  leave: RatioMetric;
  /** 缺勤 (未请假也未到) 人次 */
  absentCount: number;
  /** 课评查看率 = 家长看过的学员课评 / 已发布的学员课评 */
  evaluationView: RatioMetric;
  /** 满班率 = 在读人数 / 班级容量，只算招生中和上课中的班级 */
  classFill: RatioMetric;
  /** 已满员的班级数 */
  fullClassCount: number;
  activeClassCount: number;
}

export function ratio(numerator: number, denominator: number): RatioMetric {
  return {
    numerator,
    denominator,
    rate: denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null,
  };
}

/** 纯计算部分，便于离线测试 */
export function summarizeTeachingMetrics(input: {
  start: string;
  end: string;
  attendanceStatuses: string[];
  lessonCount: number;
  evaluationItems: Array<{ viewed: boolean }>;
  classes: Array<{ capacity: number; currentStudentCount: number }>;
}): TeachingMetrics {
  const total = input.attendanceStatuses.length;
  const attended = input.attendanceStatuses.filter((s) => s === 'present' || s === 'late').length;
  const leave = input.attendanceStatuses.filter((s) => s === 'leave').length;
  const absent = input.attendanceStatuses.filter((s) => s === 'absent').length;

  const viewed = input.evaluationItems.filter((i) => i.viewed).length;

  const classes = input.classes.filter((c) => c.capacity > 0);
  const seats = classes.reduce((sum, c) => sum + c.capacity, 0);
  // 超员的班级按满员计，避免满班率超过 100%
  const filled = classes.reduce((sum, c) => sum + Math.min(Math.max(c.currentStudentCount, 0), c.capacity), 0);

  return {
    start: input.start,
    end: input.end,
    lessonCount: input.lessonCount,
    attendance: ratio(attended, total),
    leave: ratio(leave, total),
    absentCount: absent,
    evaluationView: ratio(viewed, input.evaluationItems.length),
    classFill: ratio(filled, seats),
    fullClassCount: classes.filter((c) => c.currentStudentCount >= c.capacity).length,
    activeClassCount: classes.length,
  };
}

/**
 * 首页教学经营指标：到课率、请假率、课评查看率、满班率。
 * 课次按排课日期 (ScheduleEvent.date，北京时间的 YYYY-MM-DD) 落入统计区间；反结课冲正的点名记录不计。
 */
@Injectable()
export class TeachingMetricsAggregator {
  constructor(private readonly prisma: PrismaService) {}

  async aggregate(query: TeachingMetricsQuery): Promise<TeachingMetrics> {
    const { start, end, campusId } = query;
    if (!DATE_RE.test(start || '') || !DATE_RE.test(end || '')) {
      throw new BadRequestException('统计区间格式应为 YYYY-MM-DD');
    }
    if (start > end) {
      throw new BadRequestException('开始日期不能晚于结束日期');
    }

    const eventWhere = {
      date: { gte: start, lte: end },
      ...(campusId ? { campusId } : {}),
    };

    const [attendance, evaluationItems, classes] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { isReversed: false, scheduleEvent: eventWhere },
        select: { status: true, scheduleEventId: true },
      }),
      this.prisma.lessonEvaluationStudentItem.findMany({
        where: { evaluation: { status: 'published', scheduleEvent: eventWhere } },
        select: { studentId: true, evaluation: { select: { scheduleEventId: true } } },
      }),
      this.prisma.class.findMany({
        where: { status: { in: ACTIVE_CLASS_STATUSES }, ...(campusId ? { campusId } : {}) },
        select: { capacity: true, currentStudentCount: true },
      }),
    ]);

    // 家长看过 = 该学员这节课有任意一位家长的已读记录
    const eventIds = Array.from(new Set(evaluationItems.map((i) => i.evaluation.scheduleEventId)));
    const reads = eventIds.length
      ? await this.prisma.parentReadState.findMany({
          where: { scheduleEventId: { in: eventIds } },
          select: { studentId: true, scheduleEventId: true },
        })
      : [];
    const readKeys = new Set(reads.map((r) => `${r.studentId}|${r.scheduleEventId}`));

    return summarizeTeachingMetrics({
      start,
      end,
      attendanceStatuses: attendance.map((a) => a.status),
      lessonCount: new Set(attendance.map((a) => a.scheduleEventId)).size,
      evaluationItems: evaluationItems.map((i) => ({
        viewed: readKeys.has(`${i.studentId}|${i.evaluation.scheduleEventId}`),
      })),
      classes,
    });
  }
}
