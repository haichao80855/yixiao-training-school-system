import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { maskCnMobile } from '../../common/phone.util';
import { ParentChildrenService } from './parent-children.service';
import { MediaLinksService, PhotoLink } from './media-links.service';
import { ParentPrincipal } from './parent.types';

const ATTENDED = ['present', 'late'];
const DAY_MS = 86400000;
const LOW_HOURS_THRESHOLD = 4;

/** 课评相关查询统一 include */
const EVENT_INCLUDE = {
  class: { select: { name: true, course: { select: { name: true } } } },
  teacher: { select: { realName: true } },
  classroom: { select: { name: true } },
  evaluation: true,
} as const;

/**
 * 家长端只读查询。所有方法先经 ParentChildrenService.resolveChild 校验子女归属。
 * 只展示已发布 (published) 的课评，缺失字段返回 null，不做任何默认文案填充。
 */
@Injectable()
export class ParentPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly children: ParentChildrenService,
    private readonly media: MediaLinksService,
  ) {}

  // ------------------------------------------------------------------
  // 账号
  // ------------------------------------------------------------------
  async me(parent: ParentPrincipal) {
    const [children, session] = await Promise.all([
      this.children.listChildren(parent.phone),
      this.prisma.parentSession.findUnique({ where: { id: parent.sessionId } }),
    ]);
    const current =
      session?.lastStudentId && children.some((c) => c.studentId === session.lastStudentId)
        ? session.lastStudentId
        : children[0]?.studentId || null;
    return {
      account: { phoneMasked: maskCnMobile(parent.phone) },
      currentStudentId: current,
      children,
    };
  }

  // ------------------------------------------------------------------
  // 课表
  // ------------------------------------------------------------------
  async schedule(parent: ParentPrincipal, studentId: string, from?: string, to?: string) {
    await this.children.resolveChild(parent, studentId, { requireFull: true });
    const range = this.normalizeRange(from, to);

    const packages = await this.prisma.studentCoursePackage.findMany({
      where: { studentId, classId: { not: null }, status: { not: 'refunded' } },
      select: { classId: true },
    });
    const classIds = [...new Set(packages.map((p) => p.classId as string))];

    // 当前班级的课次 + 本时段内有考勤记录的课次 (覆盖转班前的历史课)
    const attendances = await this.prisma.attendanceRecord.findMany({
      where: { studentId, scheduleEvent: { date: { gte: range.from, lte: range.to } } },
      orderBy: { createdAt: 'desc' },
    });
    const events = await this.prisma.scheduleEvent.findMany({
      where: {
        date: { gte: range.from, lte: range.to },
        OR: [
          { classId: { in: classIds } },
          { id: { in: attendances.map((a) => a.scheduleEventId) } },
        ],
      },
      include: EVENT_INCLUDE,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    const today = this.todayInShanghai();
    return {
      from: range.from,
      to: range.to,
      lessons: events.map((e) => {
        const att = attendances.find((a) => a.scheduleEventId === e.id && !a.isReversed);
        let status: string;
        if (e.status === 'cancelled') status = 'cancelled';
        else if (att) status = att.status === 'late' ? 'present' : att.status; // present | leave | absent
        else status = e.date >= today ? 'upcoming' : 'not_recorded';
        return {
          scheduleEventId: e.id,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          courseName: e.class?.course?.name || null,
          className: e.class?.name || null,
          teacherName: e.teacher?.realName || null,
          classroomName: e.classroom?.name || null,
          classType: e.classType,
          status,
          isLate: att?.status === 'late',
          evaluationReady: !!att && ATTENDED.includes(att.status) && e.evaluation?.status === 'published',
        };
      }),
    };
  }

  // ------------------------------------------------------------------
  // 课程与课时 (仅课时，不含任何金额)
  // ------------------------------------------------------------------
  async courses(parent: ParentPrincipal, studentId: string) {
    await this.children.resolveChild(parent, studentId, { requireFull: true });
    const packages = await this.prisma.studentCoursePackage.findMany({
      where: { studentId },
      include: { course: { select: { name: true } }, class: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const since = new Date(Date.now() - 28 * DAY_MS);
    const recent = await this.prisma.attendanceRecord.findMany({
      where: { studentId, isReversed: false, createdAt: { gte: since }, packageId: { not: null } },
      select: { packageId: true, deductLessons: true },
    });

    return packages.map((p) => {
      const burned4w = recent.filter((r) => r.packageId === p.id).reduce((sum, r) => sum + r.deductLessons, 0);
      const perWeek = burned4w / 4;
      return {
        packageId: p.id,
        courseName: p.course?.name || null,
        className: p.class?.name || null,
        totalLessons: p.totalLessons,
        consumedLessons: p.consumedLessons,
        remainingLessons: p.remainingLessons,
        bonusLessons: p.bonusLessons,
        expiryDate: p.expiryDate ? p.expiryDate.toISOString().slice(0, 10) : null,
        status: p.status, // active | frozen | refunded | completed
        lowHours: p.status === 'active' && p.remainingLessons <= LOW_HOURS_THRESHOLD,
        // 近 4 周无消课时无法估算，返回 null
        estimatedWeeksLeft: perWeek > 0 ? Math.ceil(p.remainingLessons / perWeek) : null,
      };
    });
  }

  async courseUsage(parent: ParentPrincipal, studentId: string, packageId: string) {
    await this.children.resolveChild(parent, studentId, { requireFull: true });
    const pkg = await this.prisma.studentCoursePackage.findFirst({
      where: { id: packageId, studentId },
      include: { course: { select: { name: true } } },
    });
    if (!pkg) throw new NotFoundException('未找到该课程');

    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId, packageId },
      include: { scheduleEvent: { include: { evaluation: { select: { lessonTitle: true, status: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      packageId,
      courseName: pkg.course?.name || null,
      entries: records.map((r) => ({
        scheduleEventId: r.scheduleEventId,
        date: r.scheduleEvent?.date || null,
        timeSlot: r.scheduleEvent ? `${r.scheduleEvent.startTime}-${r.scheduleEvent.endTime}` : null,
        lessonTitle: r.scheduleEvent?.evaluation?.status === 'published' ? r.scheduleEvent.evaluation.lessonTitle : null,
        attendance: r.status,
        hours: r.deductLessons,
        // 反结课冲正：课时已退回
        returned: r.isReversed,
        returnedAt: r.reversedAt ? r.reversedAt.toISOString() : null,
      })),
    };
  }

  // ------------------------------------------------------------------
  // 课评
  // ------------------------------------------------------------------
  async evaluationFeed(parent: ParentPrincipal, studentId: string, cursor?: string, limit?: string) {
    await this.children.resolveChild(parent, studentId);
    const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const skip = Math.max(Number(cursor) || 0, 0);

    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId, isReversed: false },
      include: {
        scheduleEvent: {
          include: {
            ...EVENT_INCLUDE,
            evaluation: { include: { studentItems: { where: { studentId } } } },
          },
        },
      },
      orderBy: [{ scheduleEvent: { date: 'desc' } }, { scheduleEvent: { startTime: 'desc' } }],
      skip,
      take: take + 1,
    });
    const page = records.slice(0, take);
    const reads = await this.prisma.parentReadState.findMany({
      where: {
        parentAccountId: parent.parentAccountId,
        studentId,
        scheduleEventId: { in: page.map((r) => r.scheduleEventId) },
      },
      select: { scheduleEventId: true },
    });
    const readIds = new Set(reads.map((r) => r.scheduleEventId));

    return {
      items: page.map((r) => {
        const e = r.scheduleEvent;
        const ev = e?.evaluation;
        const attended = ATTENDED.includes(r.status);
        const published = attended && ev?.status === 'published';
        const own = published ? ev!.studentItems[0] : undefined;
        const ownPhotos = published ? this.media.photos(own?.photos) : [];
        const classPhotos = published ? this.media.photos(ev!.photoList) : [];
        const comment = own?.comment || ev?.teacherComment || null;
        return {
          scheduleEventId: r.scheduleEventId,
          date: e?.date || null,
          timeSlot: e ? `${e.startTime}-${e.endTime}` : null,
          courseName: e?.class?.course?.name || null,
          teacherName: e?.teacher?.realName || null,
          attendance: r.status,
          evaluation: published
            ? {
                lessonTitle: ev!.lessonTitle,
                rating: own?.rating ?? ev!.overallRating ?? null,
                tag: own?.performanceTag || null,
                commentPreview: comment ? this.stripHtml(comment).slice(0, 60) : null,
                photoThumbs: [...ownPhotos, ...classPhotos].slice(0, 3).map((p) => p.thumbUrl),
                photoCount: ownPhotos.length + classPhotos.length,
                hasVideo: !!(own?.videoUrl || ev!.videoUrl),
                publishedAt: ev!.publishedAt ? ev!.publishedAt.toISOString() : null,
                unread: !readIds.has(r.scheduleEventId),
              }
            : null,
        };
      }),
      nextCursor: records.length > take ? String(skip + take) : null,
    };
  }

  async evaluationDetail(parent: ParentPrincipal, studentId: string, scheduleEventId: string) {
    await this.children.resolveChild(parent, studentId);
    const { event, attendance } = await this.loadVisibleEvaluation(studentId, scheduleEventId);
    const ev = event.evaluation!;
    const own = await this.prisma.lessonEvaluationStudentItem.findUnique({
      where: { evaluationId_studentId: { evaluationId: ev.id, studentId } },
    });

    return {
      scheduleEventId,
      date: event.date,
      timeSlot: `${event.startTime}-${event.endTime}`,
      courseName: event.class?.course?.name || null,
      lessonTitle: ev.lessonTitle,
      teacherName: event.teacher?.realName || null,
      attendance: attendance.status,
      content: {
        html: ev.studyContent ? this.sanitizeHtml(ev.studyContent) : null,
        keyPoints: ev.studyContent ? this.keyPoints(ev.studyContent) : [],
      },
      overall: {
        rating: ev.overallRating ?? null,
        comment: ev.teacherComment || null,
        voice: ev.voiceUrl ? { url: this.media.file(ev.voiceUrl), seconds: ev.voiceDuration || null } : null,
      },
      forChild: own
        ? {
            rating: own.rating ?? null,
            tag: own.performanceTag || null,
            comment: own.comment || null,
            homework: own.homeworkTask || null,
            photos: this.media.photos(own.photos),
            video: own.videoUrl ? { url: this.media.file(own.videoUrl) } : null,
          }
        : null,
      classMedia: {
        photos: this.media.photos(ev.photoList),
        video: ev.videoUrl ? { url: this.media.file(ev.videoUrl) } : null,
      },
      publishedAt: ev.publishedAt ? ev.publishedAt.toISOString() : null,
      revision: ev.currentRevision,
    };
  }

  async markRead(parent: ParentPrincipal, studentId: string, scheduleEventId: string) {
    await this.children.resolveChild(parent, studentId);
    await this.loadVisibleEvaluation(studentId, scheduleEventId);
    await this.prisma.parentReadState.upsert({
      where: {
        parentAccountId_studentId_scheduleEventId: {
          parentAccountId: parent.parentAccountId,
          studentId,
          scheduleEventId,
        },
      },
      update: {},
      create: { parentAccountId: parent.parentAccountId, studentId, scheduleEventId },
    });
    return { success: true };
  }

  // ------------------------------------------------------------------
  // 成长相册：已发布课评照片按周汇总 (不另建表)
  // ------------------------------------------------------------------
  async album(parent: ParentPrincipal, studentId: string, cursor?: string, type?: string, limit?: string) {
    await this.children.resolveChild(parent, studentId);
    if (cursor && !/^\d{4}-\d{2}-\d{2}$/.test(cursor)) throw new BadRequestException('cursor 格式应为 YYYY-MM-DD');
    const wantPhotos = type !== 'video';
    const wantVideos = type !== 'photo';
    const weeksPerPage = Math.min(Math.max(Number(limit) || 4, 1), 12);

    const lessons = await this.attendedPublishedLessons(studentId);
    const weeks = new Map<string, { weekStart: string; weekEnd: string; lessonIds: Set<string>; photos: any[]; videos: any[] }>();

    for (const { event, own } of lessons) {
      const weekStart = this.weekStart(event.date);
      if (cursor && weekStart >= cursor) continue;
      const ev = event.evaluation!;
      const ref = { scheduleEventId: event.id, date: event.date, lessonTitle: ev.lessonTitle };
      const ownPhotos = wantPhotos ? this.media.photos(own?.photos).map((p) => ({ ...p, ...ref, isOwn: true })) : [];
      const classPhotos = wantPhotos ? this.media.photos(ev.photoList).map((p) => ({ ...p, ...ref, isOwn: false })) : [];
      const videos = wantVideos
        ? [
            own?.videoUrl ? { url: this.media.file(own.videoUrl), ...ref, isOwn: true } : null,
            ev.videoUrl ? { url: this.media.file(ev.videoUrl), ...ref, isOwn: false } : null,
          ].filter(Boolean)
        : [];
      if (!ownPhotos.length && !classPhotos.length && !videos.length) continue;

      if (!weeks.has(weekStart)) {
        weeks.set(weekStart, { weekStart, weekEnd: this.addDays(weekStart, 6), lessonIds: new Set(), photos: [], videos: [] });
      }
      const w = weeks.get(weekStart)!;
      w.lessonIds.add(event.id);
      w.photos.push(...ownPhotos, ...classPhotos);
      w.videos.push(...videos);
    }

    const ordered = [...weeks.values()].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
    const page = ordered.slice(0, weeksPerPage).map((w) => ({
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      lessonCount: w.lessonIds.size,
      // 同一周内：本人专属照片在前，其次班级照片
      photos: [...w.photos.filter((p) => p.isOwn), ...w.photos.filter((p) => !p.isOwn)],
      videos: w.videos,
    }));
    return {
      weeks: page,
      nextCursor: ordered.length > weeksPerPage ? page[page.length - 1].weekStart : null,
    };
  }

  async growthSummary(parent: ParentPrincipal, studentId: string) {
    await this.children.resolveChild(parent, studentId);
    const [attendedCount, lessons] = await Promise.all([
      this.prisma.attendanceRecord.count({
        where: { studentId, isReversed: false, status: { in: ATTENDED } },
      }),
      this.attendedPublishedLessons(studentId),
    ]);
    let photos = 0;
    let videos = 0;
    for (const { event, own } of lessons) {
      const ev = event.evaluation!;
      photos += this.media.photos(own?.photos).length + this.media.photos(ev.photoList).length;
      videos += (own?.videoUrl ? 1 : 0) + (ev.videoUrl ? 1 : 0);
    }
    return { lessonsAttended: attendedCount, evaluations: lessons.length, photos, videos };
  }

  // ------------------------------------------------------------------
  // 内部
  // ------------------------------------------------------------------
  /** 子女出勤 (含迟到) 且课评已发布的课次 */
  private async attendedPublishedLessons(studentId: string) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
        isReversed: false,
        status: { in: ATTENDED },
        scheduleEvent: { evaluation: { status: 'published' } },
      },
      include: {
        scheduleEvent: {
          include: { evaluation: { include: { studentItems: { where: { studentId } } } } },
        },
      },
      orderBy: { scheduleEvent: { date: 'desc' } },
    });
    // 同一课次可能存在多条考勤 (冲正后重点)，按课次去重
    const seen = new Set<string>();
    return records
      .filter((r) => (seen.has(r.scheduleEventId) ? false : (seen.add(r.scheduleEventId), true)))
      .map((r) => ({ event: r.scheduleEvent, own: r.scheduleEvent.evaluation!.studentItems[0] }));
  }

  /** 课评对家长可见：已发布 + 子女该课次出勤 (未冲正)；否则统一 404 */
  private async loadVisibleEvaluation(studentId: string, scheduleEventId: string) {
    const attendance = await this.prisma.attendanceRecord.findFirst({
      where: { studentId, scheduleEventId, isReversed: false, status: { in: ATTENDED } },
    });
    const event = attendance
      ? await this.prisma.scheduleEvent.findUnique({ where: { id: scheduleEventId }, include: EVENT_INCLUDE })
      : null;
    if (!attendance || !event || event.evaluation?.status !== 'published') {
      throw new NotFoundException('课评尚未发布');
    }
    return { event, attendance };
  }

  private normalizeRange(from?: string, to?: string) {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if ((from && !iso.test(from)) || (to && !iso.test(to))) {
      throw new BadRequestException('日期格式应为 YYYY-MM-DD');
    }
    const start = from || this.weekStart(this.todayInShanghai());
    const end = to || this.addDays(start, 6);
    if (end < start) throw new BadRequestException('结束日期不能早于开始日期');
    if ((Date.parse(end) - Date.parse(start)) / DAY_MS > 62) {
      throw new BadRequestException('单次最多查询 62 天课表');
    }
    return { from: start, to: end };
  }

  private todayInShanghai(): string {
    return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  }

  /** 周一为一周起点 */
  private weekStart(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    const offset = (d.getUTCDay() + 6) % 7;
    return this.addDays(date, -offset);
  }

  private addDays(date: string, days: number): string {
    return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** 小程序 rich-text 渲染前的基础清洗：移除脚本、样式、事件属性与 javascript: 链接 */
  private sanitizeHtml(html: string): string {
    return html
      .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
      .replace(/<(script|style|iframe|object|embed)[^>]*\/?>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
  }

  private keyPoints(html: string): string[] {
    return html
      .replace(/<\/(p|li|h\d|div)>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .split(/[\n;；。]/)
      .map((s) => s.replace(/\s+/g, ' '))
      .map((s) => s.trim())
      .filter((s) => s.length > 2 && s.length <= 60)
      .slice(0, 5);
  }
}
