import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** 剩余课时不高于该值进入预警 (与 ADR-0005 紧急预警口径一致) */
const LOW_LESSON_THRESHOLD = 4;
/** 剩余课时不高于该值视为紧急 */
const CRITICAL_LESSON_THRESHOLD = 2;
/** 最近连续缺勤达到该次数进入预警 */
const ABSENCE_STREAK_THRESHOLD = 2;
/** 超过该天数没有到课记录视为长期未到课 */
const INACTIVE_DAYS = 14;
/** 预警回看的考勤窗口 (天) */
const WARNING_LOOKBACK_DAYS = 60;
/** 待办统计回看的课评窗口 (天) */
const PENDING_LOOKBACK_DAYS = 30;

const ROSTER_PACKAGE_STATUSES = ['active', 'frozen'];

export interface TeacherActor {
  id: string;
  campusId?: string;
}

export type WarningType = 'low_lessons' | 'absence' | 'inactive';

/** 业务日期按校区所在时区计算，不受服务器时区影响 */
function todayInShanghai(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parsePhotos(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 网页教师端只读投影。
 * 所有查询都限定在「本人授课 / 代课 / 担任教务的班级」内，返回字段不含金额、钱包、订单等财务与销售数据，
 * 因此教师角色无需开通 student:allStudent / educational:classManagement 这类校区级管理权限。
 */
@Injectable()
export class TeacherPortalService {
  constructor(private readonly prisma: PrismaService) {}

  private myClassWhere(actor: TeacherActor): Prisma.ClassWhereInput {
    return {
      ...(actor.campusId ? { campusId: actor.campusId } : {}),
      OR: [
        { teacherId: actor.id },
        { advisorId: actor.id },
        { schedules: { some: { teacherId: actor.id } } },
      ],
    };
  }

  private myPackageWhere(actor: TeacherActor): Prisma.StudentCoursePackageWhereInput {
    return {
      status: { in: ROSTER_PACKAGE_STATUSES },
      class: this.myClassWhere(actor),
    };
  }

  async getOverview(actor: TeacherActor) {
    const today = todayInShanghai();
    const campusFilter = actor.campusId ? { campusId: actor.campusId } : {};
    const [todayLessonCount, todayPendingCount, overdueLessonCount, evaluations, warnings] = await Promise.all([
      this.prisma.scheduleEvent.count({
        where: { ...campusFilter, teacherId: actor.id, date: today, status: { not: 'cancelled' } },
      }),
      this.prisma.scheduleEvent.count({
        where: { ...campusFilter, teacherId: actor.id, date: today, status: { in: ['scheduled', 'in_progress'] } },
      }),
      this.prisma.scheduleEvent.count({
        where: {
          ...campusFilter,
          teacherId: actor.id,
          date: { lt: today, gte: shiftDate(today, -PENDING_LOOKBACK_DAYS) },
          status: { in: ['scheduled', 'in_progress'] },
        },
      }),
      this.getEvaluations(actor, { startDate: shiftDate(today, -PENDING_LOOKBACK_DAYS), endDate: today }),
      this.getWarnings(actor),
    ]);

    return {
      today,
      todayLessonCount,
      todayPendingCount,
      overdueLessonCount,
      pendingEvaluationCount: evaluations.metrics.pendingCount,
      warningCount: warnings.summary.total,
    };
  }

  /** 课评管理：已结课课次中到课学员的课评情况；请假 / 缺勤学员不计入待评 */
  async getEvaluations(
    actor: TeacherActor,
    query: { startDate?: string; endDate?: string; status?: string; keyword?: string },
  ) {
    const today = todayInShanghai();
    const endDate = query.endDate || today;
    const startDate = query.startDate || shiftDate(endDate, -6);

    const schedules = await this.prisma.scheduleEvent.findMany({
      where: {
        ...(actor.campusId ? { campusId: actor.campusId } : {}),
        teacherId: actor.id,
        status: 'completed',
        date: { gte: startDate, lte: endDate },
      },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        class: { select: { name: true, course: { select: { name: true } } } },
        attendances: {
          where: { isReversed: false, status: { in: ['present', 'late'] } },
          select: { studentId: true, student: { select: { name: true, studentNo: true } } },
        },
        evaluation: {
          select: {
            status: true,
            studentItems: {
              select: { studentId: true, comment: true, photos: true, videoUrl: true, rating: true },
            },
          },
        },
      },
    });

    const allItems = schedules.flatMap((s) => {
      const isPublished = s.evaluation?.status === 'published';
      const itemByStudent = new Map((s.evaluation?.studentItems || []).map((item) => [item.studentId, item]));
      return s.attendances.map((att) => {
        const item = itemByStudent.get(att.studentId);
        const hasContent = Boolean(item && (item.comment || item.videoUrl || parsePhotos(item.photos).length > 0));
        return {
          scheduleId: s.id,
          studentId: att.studentId,
          studentName: att.student.name,
          studentNo: att.student.studentNo,
          className: s.class.name,
          courseName: s.class.course?.name || '',
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          isPushed: isPublished && hasContent,
          rating: item?.rating ?? null,
        };
      });
    });

    const keyword = query.keyword?.trim().toLowerCase();
    const matched = keyword
      ? allItems.filter(
          (i) => i.studentName.toLowerCase().includes(keyword) || i.studentNo.toLowerCase().includes(keyword),
        )
      : allItems;

    const pushedCount = matched.filter((i) => i.isPushed).length;
    const totalCount = matched.length;
    const items =
      query.status === 'pending'
        ? matched.filter((i) => !i.isPushed)
        : query.status === 'pushed'
          ? matched.filter((i) => i.isPushed)
          : matched;

    return {
      startDate,
      endDate,
      items,
      metrics: {
        totalCount,
        pushedCount,
        pendingCount: totalCount - pushedCount,
        coverageRate: totalCount > 0 ? Math.round((pushedCount / totalCount) * 100) : 0,
      },
    };
  }

  async getClasses(actor: TeacherActor, query: { keyword?: string }) {
    const keyword = query.keyword?.trim();
    const classes = await this.prisma.class.findMany({
      where: {
        AND: [
          this.myClassWhere(actor),
          ...(keyword ? [{ OR: [{ name: { contains: keyword } }, { code: { contains: keyword } }] }] : []),
        ],
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      select: {
        id: true,
        name: true,
        status: true,
        capacity: true,
        startDate: true,
        endDate: true,
        teacherId: true,
        advisorId: true,
        course: { select: { name: true } },
        teacher: { select: { realName: true } },
        classroom: { select: { name: true } },
        schedules: { select: { date: true, startTime: true, status: true, teacherId: true } },
        studentPackages: {
          where: { status: { in: ROSTER_PACKAGE_STATUSES } },
          select: { studentId: true },
        },
      },
    });

    const today = todayInShanghai();
    return classes.map((c) => {
      const validSchedules = c.schedules.filter((s) => s.status !== 'cancelled');
      const next = validSchedules
        .filter((s) => s.status !== 'completed' && s.date >= today)
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))[0];
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        capacity: c.capacity,
        startDate: c.startDate,
        endDate: c.endDate,
        courseName: c.course?.name || '',
        teacherName: c.teacher?.realName || '',
        classroomName: c.classroom?.name || '',
        myRole: c.teacherId === actor.id ? '主讲' : c.advisorId === actor.id ? '教务' : '代课',
        studentCount: new Set(c.studentPackages.map((p) => p.studentId)).size,
        completedLessons: validSchedules.filter((s) => s.status === 'completed').length,
        totalLessons: validSchedules.length,
        nextLesson: next ? { date: next.date, startTime: next.startTime } : null,
      };
    });
  }

  async getClassDetail(actor: TeacherActor, classId: string) {
    const cls = await this.prisma.class.findFirst({
      where: { AND: [{ id: classId }, this.myClassWhere(actor)] },
      select: {
        id: true,
        name: true,
        status: true,
        capacity: true,
        startDate: true,
        endDate: true,
        teacherId: true,
        advisorId: true,
        course: { select: { name: true } },
        teacher: { select: { realName: true } },
        advisor: { select: { realName: true } },
        classroom: { select: { name: true } },
        schedules: {
          where: { status: { not: 'cancelled' } },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            status: true,
            teacherId: true,
            teacher: { select: { realName: true } },
            classroom: { select: { name: true } },
            attendances: { where: { isReversed: false }, select: { status: true } },
          },
        },
        studentPackages: {
          where: { status: { in: ROSTER_PACKAGE_STATUSES } },
          select: {
            remainingLessons: true,
            totalLessons: true,
            student: { select: { id: true, name: true, studentNo: true, phone: true, parentName: true } },
          },
        },
      },
    });
    if (!cls) throw new NotFoundException('班级不存在或不在您的授课范围内');

    const students = new Map<
      string,
      { id: string; name: string; studentNo: string; phone: string; parentName: string | null; remainingLessons: number; totalLessons: number }
    >();
    for (const pkg of cls.studentPackages) {
      const entry = students.get(pkg.student.id);
      if (entry) {
        entry.remainingLessons += pkg.remainingLessons;
        entry.totalLessons += pkg.totalLessons;
      } else {
        students.set(pkg.student.id, {
          ...pkg.student,
          remainingLessons: pkg.remainingLessons,
          totalLessons: pkg.totalLessons,
        });
      }
    }

    return {
      id: cls.id,
      name: cls.name,
      status: cls.status,
      capacity: cls.capacity,
      startDate: cls.startDate,
      endDate: cls.endDate,
      courseName: cls.course?.name || '',
      teacherName: cls.teacher?.realName || '',
      advisorName: cls.advisor?.realName || '',
      classroomName: cls.classroom?.name || '',
      myRole: cls.teacherId === actor.id ? '主讲' : cls.advisorId === actor.id ? '教务' : '代课',
      completedLessons: cls.schedules.filter((s) => s.status === 'completed').length,
      totalLessons: cls.schedules.length,
      schedules: cls.schedules.map((s) => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        teacherName: s.teacher?.realName || '',
        classroomName: s.classroom?.name || '',
        attendedCount: s.attendances.filter((a) => a.status === 'present' || a.status === 'late').length,
        recordedCount: s.attendances.length,
        // 只有本人授课的课次才能进入点名
        canOperate: s.teacherId === actor.id,
      })),
      students: Array.from(students.values()),
    };
  }

  async getStudents(actor: TeacherActor, query: { keyword?: string; page?: number; pageSize?: number }) {
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 50);
    const keyword = query.keyword?.trim();
    const packageWhere = this.myPackageWhere(actor);

    const where: Prisma.StudentWhereInput = {
      packages: { some: packageWhere },
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { studentNo: { contains: keyword } },
              { phone: { contains: keyword } },
            ],
          }
        : {}),
    };

    const [total, students] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          studentNo: true,
          gender: true,
          phone: true,
          parentName: true,
          status: true,
          packages: {
            where: packageWhere,
            select: {
              remainingLessons: true,
              class: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      list: students.map(({ packages, ...s }) => {
        const remainingLessons = packages.reduce((sum, p) => sum + p.remainingLessons, 0);
        const classMap = new Map(packages.filter((p) => p.class).map((p) => [p.class!.id, p.class!.name]));
        return {
          ...s,
          remainingLessons,
          isLowLessons: remainingLessons <= LOW_LESSON_THRESHOLD,
          classes: Array.from(classMap, ([id, name]) => ({ id, name })),
        };
      }),
    };
  }

  async getStudentDetail(actor: TeacherActor, studentId: string) {
    const classWhere = this.myClassWhere(actor);
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        OR: [
          { packages: { some: { class: classWhere } } },
          { attendances: { some: { scheduleEvent: { teacherId: actor.id } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        studentNo: true,
        gender: true,
        phone: true,
        parentName: true,
        status: true,
        birthday: true,
        school: true,
        packages: {
          where: { class: classWhere },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            totalLessons: true,
            remainingLessons: true,
            consumedLessons: true,
            course: { select: { name: true } },
            class: { select: { id: true, name: true } },
          },
        },
        attendances: {
          where: { isReversed: false, scheduleEvent: { teacherId: actor.id } },
          orderBy: { scheduleEvent: { date: 'desc' } },
          take: 30,
          select: {
            id: true,
            status: true,
            deductLessons: true,
            scheduleEvent: {
              select: {
                id: true,
                date: true,
                startTime: true,
                endTime: true,
                class: { select: { name: true } },
                evaluation: {
                  select: {
                    status: true,
                    studentItems: {
                      where: { studentId },
                      select: { comment: true, photos: true, videoUrl: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!student) throw new NotFoundException('学员不存在或不在您的授课范围内');

    const { packages, attendances, ...profile } = student;
    return {
      ...profile,
      courses: packages.map((p) => ({
        id: p.id,
        status: p.status,
        courseName: p.course?.name || '',
        classId: p.class?.id || null,
        className: p.class?.name || '',
        totalLessons: p.totalLessons,
        remainingLessons: p.remainingLessons,
        consumedLessons: p.consumedLessons,
      })),
      attendances: attendances.map((a) => {
        const event = a.scheduleEvent;
        const item = event.evaluation?.studentItems[0];
        const hasContent = Boolean(item && (item.comment || item.videoUrl || parsePhotos(item.photos).length > 0));
        return {
          id: a.id,
          scheduleId: event.id,
          status: a.status,
          deductLessons: a.deductLessons,
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
          className: event.class?.name || '',
          isEvaluated: event.evaluation?.status === 'published' && hasContent,
        };
      }),
    };
  }

  /**
   * 学员预警：只保留老师能据此行动的教学信号 (课时不足、连续缺勤、长期未到课)，处理方式是联系家长。
   * 不含续费开单、合同到期等销售流转。
   */
  async getWarnings(actor: TeacherActor) {
    const today = todayInShanghai();
    const packages = await this.prisma.studentCoursePackage.findMany({
      where: {
        status: 'active',
        class: { AND: [this.myClassWhere(actor), { status: { not: 'completed' } }] },
        student: { status: 'normal' },
      },
      select: {
        remainingLessons: true,
        class: { select: { name: true } },
        student: { select: { id: true, name: true, studentNo: true, phone: true, parentName: true } },
      },
    });

    const roster = new Map<
      string,
      { student: (typeof packages)[number]['student']; remainingLessons: number; classNames: Set<string> }
    >();
    for (const pkg of packages) {
      const entry = roster.get(pkg.student.id);
      if (entry) {
        entry.remainingLessons += pkg.remainingLessons;
        if (pkg.class) entry.classNames.add(pkg.class.name);
      } else {
        roster.set(pkg.student.id, {
          student: pkg.student,
          remainingLessons: pkg.remainingLessons,
          classNames: new Set(pkg.class ? [pkg.class.name] : []),
        });
      }
    }

    const attendances = await this.prisma.attendanceRecord.findMany({
      where: {
        isReversed: false,
        studentId: { in: Array.from(roster.keys()) },
        scheduleEvent: { teacherId: actor.id, date: { gte: shiftDate(today, -WARNING_LOOKBACK_DAYS), lte: today } },
      },
      orderBy: { scheduleEvent: { date: 'desc' } },
      select: { studentId: true, status: true, scheduleEvent: { select: { date: true } } },
    });
    const attendanceByStudent = new Map<string, typeof attendances>();
    for (const att of attendances) {
      const list = attendanceByStudent.get(att.studentId);
      if (list) list.push(att);
      else attendanceByStudent.set(att.studentId, [att]);
    }

    const inactiveBefore = shiftDate(today, -INACTIVE_DAYS);
    const items: Array<{
      id: string;
      type: WarningType;
      level: 'urgent' | 'warning';
      reason: string;
      studentId: string;
      studentName: string;
      studentNo: string;
      phone: string;
      parentName: string | null;
      classNames: string[];
      remainingLessons: number;
    }> = [];

    for (const [studentId, { student, remainingLessons, classNames }] of roster) {
      const base = {
        studentId,
        studentName: student.name,
        studentNo: student.studentNo,
        phone: student.phone,
        parentName: student.parentName,
        classNames: Array.from(classNames),
        remainingLessons,
      };

      if (remainingLessons <= LOW_LESSON_THRESHOLD) {
        items.push({
          ...base,
          id: `${studentId}-low_lessons`,
          type: 'low_lessons',
          level: remainingLessons <= CRITICAL_LESSON_THRESHOLD ? 'urgent' : 'warning',
          reason: `剩余 ${remainingLessons} 课时`,
        });
      }

      const records = attendanceByStudent.get(studentId) || [];
      const firstNonAbsent = records.findIndex((r) => r.status !== 'absent');
      const absenceStreak = firstNonAbsent === -1 ? records.length : firstNonAbsent;
      if (absenceStreak >= ABSENCE_STREAK_THRESHOLD) {
        items.push({
          ...base,
          id: `${studentId}-absence`,
          type: 'absence',
          level: absenceStreak >= ABSENCE_STREAK_THRESHOLD + 1 ? 'urgent' : 'warning',
          reason: `最近连续缺勤 ${absenceStreak} 次`,
        });
        continue;
      }

      const lastAttended = records.find((r) => r.status === 'present' || r.status === 'late');
      if (lastAttended && lastAttended.scheduleEvent.date < inactiveBefore) {
        items.push({
          ...base,
          id: `${studentId}-inactive`,
          type: 'inactive',
          level: 'warning',
          reason: `最后到课 ${lastAttended.scheduleEvent.date}，已超过 ${INACTIVE_DAYS} 天`,
        });
      }
    }

    items.sort((a, b) => Number(b.level === 'urgent') - Number(a.level === 'urgent'));

    return {
      items,
      summary: {
        total: items.length,
        low_lessons: items.filter((i) => i.type === 'low_lessons').length,
        absence: items.filter((i) => i.type === 'absence').length,
        inactive: items.filter((i) => i.type === 'inactive').length,
      },
    };
  }
}
