import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { toBusinessDateParts } from './admin-dashboard.aggregator';
import {
  DEFAULT_TEACHER_PAY_RULES,
  PayDay,
  PayLesson,
  TeacherPayLine,
  TeacherPayRules,
  TeacherPaySummary,
  computeTeacherPay,
  monthRange,
  normalizeRules,
} from './teacher-pay.engine';

/** 计酬的课次类型：只算正式课，试听课、补课暂不计 */
const PAYABLE_CLASS_TYPES = ['formal'];
/** 算作到课的点名状态 */
const ATTENDED_STATUSES = ['present', 'late'];

const rulesKey = (campusId: string) => `teacherPay.rules:${campusId}`;

export interface TeacherPayMonthView {
  campusId: string;
  month: string;
  /** draft = 未确认 (实时计算)；confirmed = 已确认 (显示确认时的快照) */
  status: 'draft' | 'confirmed';
  rules: TeacherPayRules;
  lines: TeacherPayLine[];
  summary: TeacherPaySummary;
  /** 月份是否已经结束 (北京时间)，没结束不能确认 */
  monthEnded: boolean;
  confirmedBy: string | null;
  confirmedAt: string | null;
  /** 已确认时：按现在的点名数据重算的合计，与快照不同说明确认后数据有变化 */
  liveTotalCents: number | null;
  lastReopenReason: string | null;
  lastReopenedBy: string | null;
  lastReopenedAt: string | null;
}

/**
 * 老师课酬：按月实时计算、确认锁定、撤销确认，以及按校区读写规则。
 * 权限 (校区负责人及以上) 在 controller 上校验。
 */
@Injectable()
export class TeacherPayCoordinator {
  constructor(private readonly prisma: PrismaService) {}

  async getRules(campusId: string): Promise<TeacherPayRules> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: rulesKey(campusId) } });
    if (!row) return { ...DEFAULT_TEACHER_PAY_RULES };
    try {
      return normalizeRules(JSON.parse(row.value));
    } catch {
      return { ...DEFAULT_TEACHER_PAY_RULES };
    }
  }

  async saveRules(campusId: string, input: any, userId: string): Promise<TeacherPayRules> {
    let rules: TeacherPayRules;
    try {
      rules = normalizeRules(input);
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
    await this.prisma.systemSetting.upsert({
      where: { key: rulesKey(campusId) },
      create: { key: rulesKey(campusId), value: JSON.stringify(rules), updatedBy: userId },
      update: { value: JSON.stringify(rules), updatedBy: userId },
    });
    return rules;
  }

  /** 查出该校区该月的计酬课：正式课、未取消、已点名 (有未冲正的点名记录，或已结课) */
  async loadPayLessons(campusId: string, month: string): Promise<PayLesson[]> {
    const { start, end } = this.range(month);
    const events = await this.prisma.scheduleEvent.findMany({
      where: {
        campusId,
        date: { gte: start, lte: end },
        classType: { in: PAYABLE_CLASS_TYPES },
        status: { not: 'cancelled' },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        teacherId: true,
        teacher: { select: { realName: true, account: true } },
        class: { select: { name: true, course: { select: { name: true } } } },
        evaluation: { select: { lessonTitle: true } },
        attendances: { where: { isReversed: false }, select: { status: true } },
      },
    });

    return events
      .filter((e) => e.attendances.length > 0 || e.status === 'completed')
      .map((e) => ({
        scheduleEventId: e.id,
        teacherId: e.teacherId,
        teacherName: e.teacher?.realName || e.teacher?.account || '未知老师',
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        className: e.class?.name || '',
        lessonTitle: e.evaluation?.lessonTitle || e.class?.course?.name || '',
        attendedCount: e.attendances.filter((a) => ATTENDED_STATUSES.includes(a.status)).length,
      }));
  }

  async computeLive(campusId: string, month: string, rules?: TeacherPayRules) {
    const [lessons, effectiveRules] = await Promise.all([
      this.loadPayLessons(campusId, month),
      rules ? Promise.resolve(rules) : this.getRules(campusId),
    ]);
    return { rules: effectiveRules, ...computeTeacherPay(lessons, effectiveRules) };
  }

  async getMonth(campusId: string, month: string): Promise<TeacherPayMonthView> {
    const record = await this.prisma.teacherPayrollMonth.findUnique({
      where: { campusId_month: { campusId, month } },
      include: { items: true },
    });
    const monthEnded = this.isMonthEnded(month);
    const reopenInfo = {
      lastReopenReason: record?.lastReopenReason ?? null,
      lastReopenedBy: record?.lastReopenedBy ?? null,
      lastReopenedAt: record?.lastReopenedAt?.toISOString() ?? null,
    };

    if (record && record.status === 'confirmed') {
      const rules = normalizeRules(JSON.parse(record.ruleSnapshot));
      const lines: TeacherPayLine[] = record.items
        .map((i) => ({
          teacherId: i.teacherId,
          teacherName: i.teacherName,
          teachingDays: i.teachingDays,
          lessonCount: i.lessonCount,
          attendedCount: i.attendedCount,
          bonusDays: i.bonusDays,
          baseCents: i.baseCents,
          lessonCents: i.lessonCents,
          studentCents: i.studentCents,
          bonusCents: i.bonusCents,
          totalCents: i.totalCents,
          days: JSON.parse(i.dailyDetail) as PayDay[],
        }))
        .sort((a, b) => b.totalCents - a.totalCents || a.teacherName.localeCompare(b.teacherName, 'zh-CN'));
      // 按确认时的规则重算现在的数据，只用来提示「确认后数据有变化」
      const live = await this.computeLive(campusId, month, rules);
      return {
        campusId,
        month,
        status: 'confirmed',
        rules,
        lines,
        summary: {
          teacherCount: lines.length,
          teachingDays: lines.reduce((s, l) => s + l.teachingDays, 0),
          lessonCount: lines.reduce((s, l) => s + l.lessonCount, 0),
          attendedCount: lines.reduce((s, l) => s + l.attendedCount, 0),
          totalCents: record.totalCents,
        },
        monthEnded,
        confirmedBy: record.confirmedBy,
        confirmedAt: record.confirmedAt?.toISOString() ?? null,
        liveTotalCents: live.summary.totalCents,
        ...reopenInfo,
      };
    }

    const live = await this.computeLive(campusId, month);
    return {
      campusId,
      month,
      status: 'draft',
      rules: live.rules,
      lines: live.lines,
      summary: live.summary,
      monthEnded,
      confirmedBy: null,
      confirmedAt: null,
      liveTotalCents: null,
      ...reopenInfo,
    };
  }

  /** 确认并锁定：保存当时的规则和每位老师的明细快照 */
  async confirm(campusId: string, month: string, operatorName: string): Promise<TeacherPayMonthView> {
    this.range(month);
    if (!this.isMonthEnded(month)) {
      throw new BadRequestException('这个月还没结束，月底以后再确认');
    }
    const existing = await this.prisma.teacherPayrollMonth.findUnique({
      where: { campusId_month: { campusId, month } },
      select: { status: true },
    });
    if (existing?.status === 'confirmed') {
      throw new ConflictException('这个月的课酬已经确认过了');
    }
    const live = await this.computeLive(campusId, month);

    await this.prisma.$transaction(async (tx) => {
      const data = {
        status: 'confirmed',
        ruleSnapshot: JSON.stringify(live.rules),
        totalCents: live.summary.totalCents,
        confirmedBy: operatorName,
        confirmedAt: new Date(),
      };
      const monthRow = await tx.teacherPayrollMonth.upsert({
        where: { campusId_month: { campusId, month } },
        create: { campusId, month, ...data },
        update: data,
      });
      await tx.teacherPayrollItem.deleteMany({ where: { payrollMonthId: monthRow.id } });
      for (const line of live.lines) {
        await tx.teacherPayrollItem.create({
          data: {
            payrollMonthId: monthRow.id,
            teacherId: line.teacherId,
            teacherName: line.teacherName,
            teachingDays: line.teachingDays,
            lessonCount: line.lessonCount,
            attendedCount: line.attendedCount,
            bonusDays: line.bonusDays,
            baseCents: line.baseCents,
            lessonCents: line.lessonCents,
            studentCents: line.studentCents,
            bonusCents: line.bonusCents,
            totalCents: line.totalCents,
            dailyDetail: JSON.stringify(line.days),
          },
        });
      }
    });
    return this.getMonth(campusId, month);
  }

  /** 撤销确认：必须写原因；之后按实时数据重新计算，可再次确认 */
  async reopen(campusId: string, month: string, reason: string, operatorName: string): Promise<TeacherPayMonthView> {
    const trimmed = (reason || '').trim();
    if (trimmed.length < 2) {
      throw new BadRequestException('请填写撤销确认的原因');
    }
    const record = await this.prisma.teacherPayrollMonth.findUnique({ where: { campusId_month: { campusId, month } } });
    if (!record || record.status !== 'confirmed') {
      throw new BadRequestException('这个月的课酬还没有确认，不需要撤销');
    }
    await this.prisma.$transaction([
      this.prisma.teacherPayrollItem.deleteMany({ where: { payrollMonthId: record.id } }),
      this.prisma.teacherPayrollMonth.update({
        where: { id: record.id },
        data: {
          status: 'reopened',
          lastReopenReason: trimmed.slice(0, 200),
          lastReopenedBy: operatorName,
          lastReopenedAt: new Date(),
        },
      }),
    ]);
    return this.getMonth(campusId, month);
  }

  private range(month: string) {
    try {
      return monthRange(month);
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }
  }

  /** 北京时间今天已经过了这个月的最后一天 */
  private isMonthEnded(month: string): boolean {
    const { end } = this.range(month);
    return toBusinessDateParts(new Date()).date > end;
  }
}
