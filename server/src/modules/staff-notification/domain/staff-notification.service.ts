import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/** 能收到站内通知的角色：校区负责人 (执行校长) 及以上 */
export const NOTIFIED_ROLE_CODES = ['super_admin', 'admin', 'principal'];

/** 剩余课时不多于这个数时通知负责人 (与续费预警「紧急枯竭 <=4 课时」同一口径) */
export const LOW_BALANCE_THRESHOLD = 4;

export function canReceiveStaffNotifications(user: any): boolean {
  if (!user) return false;
  if (user.permissions?.includes('*') || user.permissions?.includes('admin:all')) return true;
  return (user.roles || []).some((r: any) => NOTIFIED_ROLE_CODES.includes(typeof r === 'string' ? r : r?.code));
}

export interface StaffNotificationView {
  id: string;
  campusId: string;
  type: string;
  title: string;
  content: string;
  link: string | null;
  createdAt: string;
  read: boolean;
}

/**
 * 员工站内通知：课评发布、学员课时不足时通知校区负责人。
 * 写通知是业务主流程之外的附带动作，失败只记日志，不影响点名、消课、发布课评本身。
 */
@Injectable()
export class StaffNotificationService {
  private readonly logger = new Logger(StaffNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 同一个 dedupeKey 只写一次 (重复发布、重复结课不会刷屏) */
  private async createOnce(data: {
    campusId: string;
    type: string;
    title: string;
    content: string;
    link?: string;
    dedupeKey: string;
  }): Promise<void> {
    await this.prisma.staffNotification.upsert({
      where: { dedupeKey: data.dedupeKey },
      create: data,
      update: {},
    });
  }

  /** 课评发布 (首次发布才通知；修改后重新发布不再通知) */
  async notifyEvaluationPublished(input: { scheduleEventId: string }): Promise<void> {
    try {
      const evaluation = await this.prisma.lessonEvaluation.findUnique({
        where: { scheduleEventId: input.scheduleEventId },
        select: {
          id: true,
          campusId: true,
          status: true,
          lessonTitle: true,
          scheduleEvent: {
            select: {
              date: true,
              startTime: true,
              teacher: { select: { realName: true } },
              class: { select: { name: true } },
            },
          },
          _count: { select: { studentItems: true } },
        },
      });
      if (!evaluation || evaluation.status !== 'published') return;
      const ev = evaluation.scheduleEvent;
      await this.createOnce({
        campusId: evaluation.campusId,
        type: 'evaluation_published',
        title: `${ev?.teacher?.realName || '老师'}发布了课评`,
        content: `${ev?.class?.name || ''} ${ev?.date || ''} ${ev?.startTime || ''}「${evaluation.lessonTitle}」${
          evaluation._count.studentItems > 0 ? `，共 ${evaluation._count.studentItems} 名学员` : ''
        }`.trim(),
        link: '/educational/attendance',
        dedupeKey: `evaluation_published:${evaluation.id}`,
      });
    } catch (err: any) {
      this.logger.warn(`写入课评发布通知失败: ${err?.message || err}`);
    }
  }

  /**
   * 消课后检查这些学员在该课程的剩余课时 (所有在用课包合计)，降到阈值以内时通知。
   * 每个学员每个课程按最新课包只通知一次；续费后有了新课包，下次再降到阈值以内会再通知。
   */
  async notifyLowBalance(input: { campusId: string; courseId: string; studentIds: string[] }): Promise<void> {
    if (!input.studentIds.length) return;
    try {
      const packages = await this.prisma.studentCoursePackage.findMany({
        where: {
          studentId: { in: Array.from(new Set(input.studentIds)) },
          courseId: input.courseId,
          status: { in: ['active', 'frozen', 'completed'] },
        },
        select: {
          id: true,
          studentId: true,
          status: true,
          remainingLessons: true,
          createdAt: true,
          student: { select: { name: true, studentNo: true } },
          course: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      const byStudent = new Map<string, typeof packages>();
      for (const p of packages) {
        const list = byStudent.get(p.studentId) || [];
        list.push(p);
        byStudent.set(p.studentId, list);
      }

      for (const [studentId, list] of byStudent) {
        const remaining = list
          .filter((p) => p.status === 'active' || p.status === 'frozen')
          .reduce((sum, p) => sum + Math.max(0, p.remainingLessons), 0);
        if (remaining > LOW_BALANCE_THRESHOLD) continue;
        const latest = list[list.length - 1];
        const studentName = latest.student?.name || '学员';
        await this.createOnce({
          campusId: input.campusId,
          type: 'low_balance',
          title: remaining === 0 ? `${studentName} 课时已用完` : `${studentName} 只剩 ${remaining} 课时`,
          content: `${latest.course?.name || '课程'}${latest.student?.studentNo ? ` · 学号 ${latest.student.studentNo}` : ''}，请及时联系家长续费`,
          link: '/studentCenter/allStudent',
          dedupeKey: `low_balance:${studentId}:${latest.id}`,
        });
      }
    } catch (err: any) {
      this.logger.warn(`写入课时不足通知失败: ${err?.message || err}`);
    }
  }

  /** campusId 为空表示全部校区 (集团管理员) */
  async list(userId: string, campusId: string | undefined, limit = 20): Promise<{ items: StaffNotificationView[]; unreadCount: number }> {
    const where = campusId ? { campusId } : {};
    const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const [rows, unreadCount] = await Promise.all([
      this.prisma.staffNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        include: { reads: { where: { userId }, select: { id: true } } },
      }),
      this.prisma.staffNotification.count({ where: { ...where, reads: { none: { userId } } } }),
    ]);
    return {
      unreadCount,
      items: rows.map((r) => ({
        id: r.id,
        campusId: r.campusId,
        type: r.type,
        title: r.title,
        content: r.content,
        link: r.link,
        createdAt: r.createdAt.toISOString(),
        read: r.reads.length > 0,
      })),
    };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.staffNotificationRead.upsert({
      where: { notificationId_userId: { notificationId, userId } },
      create: { notificationId, userId },
      update: {},
    });
  }

  async markAllRead(userId: string, campusId: string | undefined): Promise<number> {
    const unread = await this.prisma.staffNotification.findMany({
      where: { ...(campusId ? { campusId } : {}), reads: { none: { userId } } },
      select: { id: true },
    });
    for (const n of unread) {
      await this.markRead(userId, n.id);
    }
    return unread.length;
  }
}
