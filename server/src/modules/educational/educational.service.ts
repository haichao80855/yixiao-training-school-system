import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClassroomDto, UpdateClassroomDto } from './dto/classroom.dto';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateScheduleDto, CheckCollisionDto } from './dto/schedule.dto';
import { RollCallDto } from './dto/attendance.dto';
import { LessonSettlementEngine } from './domain/lesson-settlement.engine';
import { WorkbenchQuery } from './domain/lesson-settlement.types';

import { CourseDeliveryEngine } from '../curriculum/domain/course-delivery.engine';
import { ClassRosterCoordinator } from './domain/class-roster.coordinator';

@Injectable()
export class EducationalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlementEngine: LessonSettlementEngine,
    private readonly deliveryEngine: CourseDeliveryEngine,
    private readonly rosterCoordinator: ClassRosterCoordinator,
  ) {}

  // ----------------------------------------------------------------
  // 0. 在职讲师与教务人员列表 (Teachers)
  // ----------------------------------------------------------------

  async getTeachers(campusId?: string) {
    const where: any = { status: 'active' };
    if (campusId && campusId !== 'all') {
      where.campusId = campusId;
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        campus: true,
        userRoles: {
          include: { role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return users.map((u) => {
      const primaryRole = u.userRoles[0]?.role;
      return {
        id: u.id,
        account: u.account,
        name: u.realName,
        realName: u.realName,
        phone: u.phone || '',
        campusId: u.campusId,
        campusName: u.campus?.name || '总部校区',
        roleId: primaryRole?.id || '',
        role: primaryRole?.code || 'teacher',
        roleName: primaryRole?.name || '授课讲师',
        subjects: ['少儿编程', 'Python', 'C++信奥'],
        status: u.status,
      };
    });
  }

  // ----------------------------------------------------------------
  // 1. 教室资源管理 (Classroom)
  // ----------------------------------------------------------------

  async getClassrooms(campusId?: string) {
    const where = campusId ? { campusId } : {};
    return this.prisma.classroom.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        campus: { select: { id: true, name: true, code: true } },
        _count: { select: { classes: true, schedules: true } },
      },
    });
  }

  async createClassroom(dto: CreateClassroomDto) {
    const inputCode = dto.code?.trim();
    let code: string;
    if (inputCode) {
      const existing = await this.prisma.classroom.findUnique({
        where: { code: inputCode },
      });
      if (existing) {
        throw new BadRequestException(`教室编码 ${inputCode} 已存在`);
      }
      code = inputCode;
    } else {
      // 快速建室表单不填编码：按现有约定 CR-<校区后缀>-<序号> 自动生成（如 campus-bj-hq → CR-HQ-103）
      code = await this.generateClassroomCode(dto.campusId);
    }

    return this.prisma.classroom.create({
      data: {
        campusId: dto.campusId,
        code,
        name: dto.name,
        capacity: dto.capacity || 12,
        type: dto.type || 'maker',
        status: dto.status || 'available',
      },
    });
  }

  /** 生成校区内下一个可用教室编码：CR-<校区编码末段大写>-<最大序号+1，起始 101> */
  private async generateClassroomCode(campusId: string): Promise<string> {
    const campus = campusId
      ? await this.prisma.campus.findUnique({ where: { id: campusId }, select: { code: true } })
      : null;
    const suffix = ((campus?.code || campusId || 'HQ').split('-').pop() || 'HQ')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase() || 'HQ';
    const prefix = `CR-${suffix}-`;

    const siblings = await this.prisma.classroom.findMany({
      where: { code: { startsWith: prefix } },
      select: { code: true },
    });
    const maxSeq = siblings.reduce((max, c) => {
      const m = c.code.slice(prefix.length).match(/^(\d+)$/);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 100);
    return `${prefix}${maxSeq + 1}`;
  }

  async updateClassroom(id: string, dto: UpdateClassroomDto) {
    return this.prisma.classroom.update({
      where: { id },
      data: dto,
    });
  }

  async deleteClassroom(id: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
      include: { _count: { select: { classes: true, schedules: true } } },
    });
    if (!classroom) {
      throw new NotFoundException(`教室 ${id} 不存在`);
    }
    if (classroom._count.classes > 0 || classroom._count.schedules > 0) {
      throw new BadRequestException('该教室已被班级或排课日程绑定，禁止删除');
    }

    await this.prisma.classroom.delete({ where: { id } });
    return { success: true, message: '教室已删除' };
  }

  // ----------------------------------------------------------------
  // 2. 班级档案管理 (Class)
  // ----------------------------------------------------------------

  async getClasses(query: {
    campusId?: string;
    courseId?: string;
    teacherId?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.campusId) where.campusId = query.campusId;
    if (query.courseId) where.courseId = query.courseId;
    if (query.teacherId) where.teacherId = query.teacherId;
    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword } },
        { code: { contains: query.keyword } },
      ];
    }

    const [total, list] = await Promise.all([
      this.prisma.class.count({ where }),
      this.prisma.class.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          campus: { select: { id: true, name: true } },
          course: { select: { id: true, name: true, code: true, pricePerLesson: true } },
          teacher: { select: { id: true, realName: true, phone: true } },
          advisor: { select: { id: true, realName: true, phone: true } },
          classroom: { select: { id: true, name: true, code: true, capacity: true } },
          _count: { select: { studentPackages: true, schedules: true } },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      list: list.map((c) => ({
        ...c,
        enrolledCount: c._count.studentPackages,
        scheduleCount: c._count.schedules,
      })),
    };
  }

  async getClassById(id: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        campus: true,
        course: true,
        teacher: true,
        advisor: true,
        classroom: true,
        schedules: {
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
          include: {
            teacher: { select: { id: true, realName: true } },
            classroom: { select: { id: true, name: true, code: true } },
            _count: { select: { attendances: true } },
          },
        },
        studentPackages: {
          include: {
            student: true,
          },
        },
      },
    });
    if (!cls) {
      throw new NotFoundException(`未找到班级 ID: ${id}`);
    }
    return cls;
  }

  async createClass(dto: CreateClassDto) {
    // 跨校区课程交付准入强校验 (Delivery Access Invariant)
    await this.deliveryEngine.assertDeliveryAccess(dto.courseId, dto.campusId);

    const existing = await this.prisma.class.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`班级代码 ${dto.code} 已存在`);
    }

    return this.prisma.class.create({
      data: {
        campusId: dto.campusId,
        courseId: dto.courseId,
        code: dto.code,
        name: dto.name,
        teacherId: dto.teacherId,
        advisorId: dto.advisorId || null,
        classroomId: dto.classroomId,
        capacity: dto.capacity || 8,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: 'recruiting',
      },
      include: {
        course: true,
        teacher: true,
        classroom: true,
      },
    });
  }

  async updateClass(id: string, dto: UpdateClassDto) {
    // 显式白名单组装更新数据：前端日期为 YYYY-MM-DD 字符串，需与 createClass 一致转换为 Date；
    // 同时避免把请求体中的非可编辑字段原样写库（全局未启用 ValidationPipe 白名单过滤）
    const toDate = (value: string, label: string) => {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException(`${label}格式不正确：${value}`);
      }
      return d;
    };

    const data: Prisma.ClassUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.capacity !== undefined) data.capacity = Number(dto.capacity);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.teacherId) data.teacherId = dto.teacherId;
    if (dto.classroomId) data.classroomId = dto.classroomId;
    if (dto.advisorId !== undefined) data.advisorId = dto.advisorId || null;
    if (dto.startDate) data.startDate = toDate(dto.startDate, '开班日期');
    if (dto.endDate) data.endDate = toDate(dto.endDate, '结课日期');

    if (data.startDate && data.endDate && (data.startDate as Date) > (data.endDate as Date)) {
      throw new BadRequestException('结课日期不能早于开班日期');
    }

    return this.prisma.class.update({
      where: { id },
      data,
    });
  }

  async bindStudentToClass(classId: string, studentId: string) {
    const result = await this.rosterCoordinator.assignStudents({
      classId,
      studentIds: [studentId],
    });

    return {
      success: true,
      message: result.message,
      classId: result.classId,
      studentId,
      currentStudentCount: result.currentStudentCount,
    };
  }

  /**
   * 班级删除 (三级数据完整性与风控边界检查)
   */
  async deleteClass(id: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        studentPackages: true,
        schedules: {
          include: { attendances: true },
        },
      },
    });

    if (!cls) {
      throw new NotFoundException(`未找到班级 ID: ${id}`);
    }

    // 1. 检查是否存在在读学员 (active 课包)
    const activeStudentsCount = cls.studentPackages.filter(
      (p) => p.status === 'active',
    ).length;

    if (activeStudentsCount > 0 || cls.currentStudentCount > 0) {
      throw new BadRequestException(
        `该班级下仍有 ${activeStudentsCount || cls.currentStudentCount} 名在读学员，禁止删除！请先为学员办理转班或移出班级。`,
      );
    }

    // 2. 检查是否存在已结课或有点名消课考勤记录的排课
    const hasAttendanceRecords = cls.schedules.some(
      (s) => s.attendances.length > 0 || s.status === 'completed',
    );

    if (hasAttendanceRecords) {
      throw new BadRequestException(
        '该班级已存在已结课或有点名考勤消课记录的排课日程，禁止删除！如需停用请调整班级状态为已结业(completed)。',
      );
    }

    // 3. 安全事务执行
    return this.prisma.$transaction(async (tx) => {
      // 3.1 解除历史课包的外键绑定 (避免外键约束冲突)
      await tx.studentCoursePackage.updateMany({
        where: { classId: id },
        data: { classId: null },
      });

      // 3.2 清理未执行的空排课日程
      await tx.scheduleEvent.deleteMany({
        where: { classId: id },
      });

      // 3.3 删除班级实体
      await tx.class.delete({
        where: { id },
      });

      return {
        success: true,
        message: '班级删除成功',
      };
    });
  }

  // ----------------------------------------------------------------
  // 3. 7×15 动态甘特排课矩阵与三维碰撞检测引擎 (Collision Engine)
  // ----------------------------------------------------------------

  /**
   * 三维冲突碰撞检测核心算法
   * 检验：①讲师冲突 ②教室冲突 ③班级冲突
   */
  async checkCollision(dto: CheckCollisionDto) {
    // 找出同日期的所有活动日程
    const sameDaySchedules = await this.prisma.scheduleEvent.findMany({
      where: {
        date: dto.date,
        status: { not: 'cancelled' },
        ...(dto.excludeScheduleId ? { id: { not: dto.excludeScheduleId } } : {}),
      },
      include: {
        teacher: { select: { realName: true } },
        classroom: { select: { name: true } },
        class: { select: { name: true } },
      },
    });

    const conflicts: Array<{
      type: 'teacher' | 'classroom' | 'class';
      message: string;
      conflictingScheduleId: string;
    }> = [];

    // 时间重叠判定函数: startA < endB && endA > startB
    const isOverlap = (s1: string, e1: string, s2: string, e2: string) => {
      return s1 < e2 && e1 > s2;
    };

    for (const item of sameDaySchedules) {
      if (isOverlap(dto.startTime, dto.endTime, item.startTime, item.endTime)) {
        // 1. 讲师冲突
        if (item.teacherId === dto.teacherId) {
          conflicts.push({
            type: 'teacher',
            message: `讲师【${item.teacher.realName}】在时段 ${item.startTime}-${item.endTime} 已有授课安排【${item.class.name}】`,
            conflictingScheduleId: item.id,
          });
        }
        // 2. 教室占用冲突
        if (item.classroomId === dto.classroomId) {
          conflicts.push({
            type: 'classroom',
            message: `教室【${item.classroom.name}】在时段 ${item.startTime}-${item.endTime} 已被占用`,
            conflictingScheduleId: item.id,
          });
        }
        // 3. 班级日程冲突
        if (item.classId === dto.classId) {
          conflicts.push({
            type: 'class',
            message: `班级【${item.class.name}】在时段 ${item.startTime}-${item.endTime} 已安排其他课程`,
            conflictingScheduleId: item.id,
          });
        }
      }
    }

    // 4. 教室容量三维冲突校验 (班级学员人数超限)
    if (dto.classroomId && dto.classId) {
      const [classroom, cls] = await Promise.all([
        this.prisma.classroom.findUnique({ where: { id: dto.classroomId } }),
        this.prisma.class.findUnique({
          where: { id: dto.classId },
          include: { studentPackages: true },
        }),
      ]);
      if (classroom && cls) {
        const studentCount = cls.studentPackages.filter(
          (p) => p.status === 'active',
        ).length;
        if (classroom.capacity && studentCount > classroom.capacity) {
          conflicts.push({
            type: 'classroom',
            message: `教室【${classroom.name}】容量上限为 ${classroom.capacity} 人，但班级【${cls.name}】在读学员为 ${studentCount} 人，超出教室容量上限`,
            conflictingScheduleId: '',
          });
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * 查询排课看板日程
   */
  /**
   * 派生课次的「第几讲」与讲次主题：
   * - lessonNumber：该课次在本班全部未取消课次中按 日期+开始时间 排序的序号（1 起）
   * - lessonTitle：课程大纲（单元 sort → 课时 sort 展开）中对应序号的课时名称；大纲未覆盖时不返回，由前端显示「第 N 讲」
   * 已取消的课次不占序号。
   */
  private async resolveLessonSequence(
    schedules: Array<{ id: string; classId: string; class?: { course?: { id: string } | null } | null }>,
  ): Promise<Map<string, { lessonNumber: number; lessonTitle?: string }>> {
    const result = new Map<string, { lessonNumber: number; lessonTitle?: string }>();
    const classIds = Array.from(new Set(schedules.map((s) => s.classId).filter(Boolean)));
    if (classIds.length === 0) return result;

    const courseByClass = new Map<string, string>();
    for (const s of schedules) {
      if (s.class?.course?.id) courseByClass.set(s.classId, s.class.course.id);
    }
    const courseIds = Array.from(new Set(courseByClass.values()));

    const [classEvents, units] = await Promise.all([
      this.prisma.scheduleEvent.findMany({
        where: { classId: { in: classIds }, status: { not: 'cancelled' } },
        select: { id: true, classId: true },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
      }),
      courseIds.length
        ? this.prisma.courseUnit.findMany({
            where: { courseId: { in: courseIds } },
            orderBy: { sort: 'asc' },
            include: { lessons: { orderBy: { sort: 'asc' }, select: { lessonName: true } } },
          })
        : Promise.resolve([] as Array<{ courseId: string; lessons: { lessonName: string }[] }>),
    ]);

    const syllabusByCourse = new Map<string, string[]>();
    for (const u of units) {
      const list = syllabusByCourse.get(u.courseId) || [];
      list.push(...u.lessons.map((l) => l.lessonName));
      syllabusByCourse.set(u.courseId, list);
    }

    const counters = new Map<string, number>();
    for (const ev of classEvents) {
      const n = (counters.get(ev.classId) || 0) + 1;
      counters.set(ev.classId, n);
      const courseId = courseByClass.get(ev.classId);
      const title = courseId ? syllabusByCourse.get(courseId)?.[n - 1] : undefined;
      result.set(ev.id, { lessonNumber: n, ...(title ? { lessonTitle: title } : {}) });
    }
    return result;
  }

  async getSchedules(query: {
    campusId?: string;
    startDate?: string;
    endDate?: string;
    date?: string;
    teacherId?: string;
    classroomId?: string;
    classId?: string;
  }) {
    const where: any = {};
    if (query.campusId) where.campusId = query.campusId;
    if (query.date) where.date = query.date;
    if (query.startDate && query.endDate) {
      where.date = {
        gte: query.startDate,
        lte: query.endDate,
      };
    }
    if (query.teacherId) where.teacherId = query.teacherId;
    if (query.classroomId) where.classroomId = query.classroomId;
    if (query.classId) where.classId = query.classId;

    const schedules = await this.prisma.scheduleEvent.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: {
        teacher: { select: { id: true, realName: true } },
        classroom: { select: { id: true, name: true, code: true } },
        class: {
          select: {
            id: true,
            name: true,
            code: true,
            capacity: true,
            currentStudentCount: true,
            course: { select: { id: true, name: true, subject: true } },
            studentPackages: {
              where: { status: 'active' },
              select: { studentId: true },
            },
          },
        },
        attendances: {
          where: { isReversed: false },
          select: { studentId: true, status: true },
        },
        _count: { select: { attendances: true } },
        evaluation: { select: { id: true, status: true, updatedAt: true } },
      },
    });

    const lessonInfo = await this.resolveLessonSequence(schedules);

    return schedules.map((s: any) => {
      const activePackageStudentIds = (s.class?.studentPackages || []).map((p: any) => p.studentId);
      const attendanceStudentIds = (s.attendances || []).map((a: any) => a.studentId);
      const uniqueStudentIds = Array.from(new Set([...activePackageStudentIds, ...attendanceStudentIds]));

      const expectedCount = uniqueStudentIds.length > 0
        ? uniqueStudentIds.length
        : (s.class?.currentStudentCount ?? 0);

      const presentAttendances = (s.attendances || []).filter(
        (a: any) => a.status === 'present' || a.status === 'late'
      );
      const actualCount = presentAttendances.length;

      return {
        ...s,
        studentIds: uniqueStudentIds,
        totalStudents: expectedCount,
        expectedCount,
        studentCount: expectedCount,
        signedCount: actualCount,
        actualCount,
        attendanceCount: actualCount,
        evaluationStatus: s.evaluation?.status || 'none',
        // 讲次序号与主题（ScheduleEvent 本身不存储，按班级课次顺序 + 课程大纲派生）
        lessonNumber: lessonInfo.get(s.id)?.lessonNumber,
        lessonTitle: lessonInfo.get(s.id)?.lessonTitle,
      };
    });
  }

  /**
   * 创建排课日程 (自适应冲突标记与 Lane 泳道计算)
   */
  async createSchedule(dto: CreateScheduleDto) {
    // 跨校区排课准入核验：核验班级所属课程对该排课校区是否具备交付授权
    const cls = await this.prisma.class.findUnique({
      where: { id: dto.classId },
    });
    if (!cls) {
      throw new NotFoundException(`未找到对应班级 ID: ${dto.classId}`);
    }
    await this.deliveryEngine.assertDeliveryAccess(cls.courseId, dto.campusId);

    // 碰撞检测
    const collisionCheck = await this.checkCollision({
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      teacherId: dto.teacherId,
      classroomId: dto.classroomId,
      classId: dto.classId,
    });

    let semanticType = dto.semanticType || 'regular';
    if (collisionCheck.hasConflict) {
      semanticType = 'conflict'; // 盛通高保真规范：冲突日程标记为 conflict 红色跳动高亮
    }

    // 计算当日重叠的 Lane 索引
    const overlapping = await this.prisma.scheduleEvent.count({
      where: {
        date: dto.date,
        startTime: { lt: dto.endTime },
        endTime: { gt: dto.startTime },
        status: { not: 'cancelled' },
      },
    });

    return this.prisma.scheduleEvent.create({
      data: {
        campusId: dto.campusId,
        classId: dto.classId,
        teacherId: dto.teacherId,
        classroomId: dto.classroomId,
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        semanticType,
        classType: dto.classType || 'formal',
        status: 'scheduled',
        laneIndex: overlapping % 4,
      },
      include: {
        teacher: true,
        classroom: true,
        class: true,
      },
    });
  }

  async deleteSchedule(id: string) {
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id },
      include: { attendances: true },
    });
    if (!schedule) {
      throw new NotFoundException(`排课日程 ${id} 不存在`);
    }
    if (schedule.attendances.length > 0) {
      throw new BadRequestException('已产生点名消课记录的排课日程禁止直接删除，请先反结课冲正');
    }

    await this.prisma.scheduleEvent.delete({ where: { id } });
    return { success: true, message: '排课日程已删除' };
  }

  // ----------------------------------------------------------------
  // 4. 点名消课授课工作台与反结课冲正机制 (Attendance & Reversal - 委托至 LessonSettlementEngine)
  // ----------------------------------------------------------------

  /**
   * 获取排课日程对应的点名学员名单及课包余额
   */
  async getRollCallStudents(scheduleEventId: string) {
    const session = await this.settlementEngine.prepareRollCallSession(scheduleEventId);
    return session.students;
  }

  /**
   * 随堂点名消课 (批量事务扣除课时)
   */
  async rollCall(dto: RollCallDto, operatorName: string) {
    return this.settlementEngine.settleRollCall(dto, operatorName);
  }

  /**
   * 盛通反结课 / 撤销点名冲正机制 (防重放与课时原路退还)
   */
  async reverseScheduleAttendance(scheduleEventId: string, operatorName: string, reason?: string) {
    return this.settlementEngine.reverseRollCall(scheduleEventId, operatorName, reason);
  }

  /**
   * 获取授课工作台就绪快照与看板指标
   */
  async getWorkbenchSnapshot(query: WorkbenchQuery) {
    return this.settlementEngine.getWorkbenchSnapshot(query);
  }

  /**
   * 更新排课日程状态或基础信息
   */
  async updateSchedule(id: string, data: any) {
    const existing = await this.prisma.scheduleEvent.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`未找到排课日程 ${id}`);
    }

    return this.prisma.scheduleEvent.update({
      where: { id },
      data: {
        ...(data.date ? { date: data.date } : {}),
        ...(data.startTime ? { startTime: data.startTime } : {}),
        ...(data.endTime ? { endTime: data.endTime } : {}),
        ...(data.teacherId ? { teacherId: data.teacherId } : {}),
        ...(data.classroomId ? { classroomId: data.classroomId } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.lessonTitle ? { lessonTitle: data.lessonTitle } : {}),
        ...(data.lessonPeriod ? { lessonPeriod: data.lessonPeriod } : {}),
        ...(data.color ? { color: data.color } : {}),
        ...(data.semanticType ? { semanticType: data.semanticType } : {}),
        ...(data.lane !== undefined ? { lane: data.lane } : {}),
        ...(data.isConflict !== undefined ? { isConflict: data.isConflict } : {}),
      },
      include: {
        class: true,
        teacher: true,
        classroom: true,
      },
    });
  }

  /**
   * 获取考勤点名台账流水记录
   */
  async getAttendanceRecords(query: { campusId?: string; classId?: string; scheduleEventId?: string; studentId?: string }) {
    if (query.studentId || query.scheduleEventId) {
      const where: any = {};
      if (query.scheduleEventId) where.scheduleEventId = query.scheduleEventId;
      if (query.studentId) where.studentId = query.studentId;
      if (query.classId) {
        where.scheduleEvent = { classId: query.classId };
      }
      if (query.campusId && query.campusId !== 'all') {
        where.scheduleEvent = { ...(where.scheduleEvent || {}), campusId: query.campusId };
      }

      return this.prisma.attendanceRecord.findMany({
        where,
        include: {
          scheduleEvent: {
            include: {
              class: true,
              teacher: true,
              classroom: true,
            },
          },
          student: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const snapshot = await this.settlementEngine.getWorkbenchSnapshot({
      campusId: query.campusId,
      classId: query.classId,
    });
    return snapshot.history;
  }
}
