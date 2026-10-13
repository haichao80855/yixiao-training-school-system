import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClassroomDto, UpdateClassroomDto } from './dto/classroom.dto';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateScheduleDto, CheckCollisionDto } from './dto/schedule.dto';
import { RollCallDto } from './dto/attendance.dto';

@Injectable()
export class EducationalService {
  constructor(private readonly prisma: PrismaService) {}

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
    const existing = await this.prisma.classroom.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`教室编码 ${dto.code} 已存在`);
    }

    return this.prisma.classroom.create({
      data: {
        campusId: dto.campusId,
        code: dto.code,
        name: dto.name,
        capacity: dto.capacity || 12,
        type: dto.type || 'maker',
        status: dto.status || 'available',
      },
    });
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
    return this.prisma.class.update({
      where: { id },
      data: dto,
    });
  }

  async bindStudentToClass(classId: string, studentId: string) {
    const cls = await this.getClassById(classId);

    // 查找该学员是否持有该班级对应课程的有效课包
    const pkg = await this.prisma.studentCoursePackage.findFirst({
      where: {
        studentId,
        courseId: cls.courseId,
        status: 'active',
      },
    });

    if (!pkg) {
      throw new BadRequestException(`学员尚未报读或未持有该班级对应课程的有效课包`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.studentCoursePackage.update({
        where: { id: pkg.id },
        data: { classId },
      });

      const updatedClass = await tx.class.update({
        where: { id: classId },
        data: {
          currentStudentCount: { increment: 1 },
        },
      });

      return {
        success: true,
        message: '学员已成功编入班级',
        classId,
        studentId,
        currentStudentCount: updatedClass.currentStudentCount,
      };
    });
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

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * 查询排课看板日程
   */
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
            course: { select: { id: true, name: true, subject: true } },
          },
        },
        _count: { select: { attendances: true } },
      },
    });

    return schedules;
  }

  /**
   * 创建排课日程 (自适应冲突标记与 Lane 泳道计算)
   */
  async createSchedule(dto: CreateScheduleDto) {
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
  // 4. 点名消课授课工作台与反结课冲正机制 (Attendance & Reversal)
  // ----------------------------------------------------------------

  /**
   * 获取排课日程对应的点名学员名单及课包余额
   */
  async getRollCallStudents(scheduleEventId: string) {
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: scheduleEventId },
      include: {
        class: {
          include: {
            course: true,
            studentPackages: {
              where: { status: 'active' },
              include: {
                student: {
                  select: {
                    id: true,
                    studentNo: true,
                    name: true,
                    phone: true,
                    gender: true,
                  },
                },
              },
            },
          },
        },
        attendances: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException(`未找到排课日程 ID: ${scheduleEventId}`);
    }

    const attendanceMap = new Map(schedule.attendances.map((a) => [a.studentId, a]));

    return schedule.class.studentPackages.map((pkg) => {
      const recorded = attendanceMap.get(pkg.studentId);
      return {
        studentId: pkg.student.id,
        studentNo: pkg.student.studentNo,
        name: pkg.student.name,
        phone: pkg.student.phone,
        packageId: pkg.id,
        remainingLessons: pkg.remainingLessons,
        bonusLessons: pkg.bonusLessons,
        totalLessons: pkg.totalLessons,
        attendanceStatus: recorded ? recorded.status : 'present',
        isRecorded: !!recorded,
        score: recorded ? recorded.score : null,
        rating: recorded ? recorded.rating : null,
        comment: recorded ? recorded.comment : '',
      };
    });
  }

  /**
   * 随堂点名消课 (批量事务扣除课时)
   */
  async rollCall(dto: RollCallDto, operatorName: string) {
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: dto.scheduleEventId },
      include: {
        class: true,
        attendances: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException(`未找到排课日程 ${dto.scheduleEventId}`);
    }

    if (schedule.status === 'completed') {
      throw new BadRequestException('该排课日程已点名结课，如需变更请先执行反结课冲正');
    }

    return this.prisma.$transaction(async (tx) => {
      const records = [];

      for (const item of dto.items) {
        const deductLessons = item.deductLessons !== undefined ? item.deductLessons : 1;

        // 1. 创建 AttendanceRecord
        const rec = await tx.attendanceRecord.create({
          data: {
            scheduleEventId: schedule.id,
            studentId: item.studentId,
            status: item.status,
            deductLessons: item.status === 'present' || item.status === 'late' ? deductLessons : 0,
            comment: item.comment || null,
            score: item.score || null,
            rating: item.rating || null,
            operator: operatorName,
            isReversed: false,
          },
        });
        records.push(rec);

        // 2. 如果出勤，原子级扣减学员课包剩余课时
        if (item.status === 'present' || item.status === 'late') {
          const pkg = await tx.studentCoursePackage.findFirst({
            where: {
              studentId: item.studentId,
              courseId: schedule.class.courseId,
              status: 'active',
            },
          });

          if (pkg) {
            await tx.studentCoursePackage.update({
              where: { id: pkg.id },
              data: {
                remainingLessons: { decrement: deductLessons },
                consumedLessons: { increment: deductLessons },
              },
            });
          }
        }
      }

      // 3. 更新排课日程状态为 completed，语义类型为已结课 completed (盛通绿色标签)
      await tx.scheduleEvent.update({
        where: { id: schedule.id },
        data: {
          status: 'completed',
          semanticType: 'completed',
        },
      });

      return {
        success: true,
        scheduleEventId: schedule.id,
        completedCount: records.length,
        message: `成功完成 ${records.length} 名学员的点名消课`,
      };
    });
  }

  /**
   * 盛通反结课 / 撤销点名冲正机制 (防重放与课时原路退还)
   */
  async reverseScheduleAttendance(scheduleEventId: string, operatorName: string) {
    const schedule = await this.prisma.scheduleEvent.findUnique({
      where: { id: scheduleEventId },
      include: {
        class: true,
        attendances: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException(`未找到排课日程 ${scheduleEventId}`);
    }

    if (schedule.attendances.length === 0) {
      throw new BadRequestException('该日程尚未点名，无需反结课冲正');
    }

    // 检查是否已经全被冲正
    const activeAttendances = schedule.attendances.filter((a) => !a.isReversed);
    if (activeAttendances.length === 0) {
      throw new BadRequestException('该排课日程的点名记录已被冲正，严禁重复反结课（抵御重放刷课）');
    }

    return this.prisma.$transaction(async (tx) => {
      let refundedLessonTotal = 0;

      for (const att of activeAttendances) {
        // 1. 如果该条记录曾经扣减过课时，原路退还学员课包
        if (att.deductLessons > 0) {
          const pkg = await tx.studentCoursePackage.findFirst({
            where: {
              studentId: att.studentId,
              courseId: schedule.class.courseId,
            },
          });

          if (pkg) {
            await tx.studentCoursePackage.update({
              where: { id: pkg.id },
              data: {
                remainingLessons: { increment: att.deductLessons },
                consumedLessons: { decrement: att.deductLessons },
              },
            });
            refundedLessonTotal += att.deductLessons;
          }
        }

        // 2. 打上不可逆冲正标记
        await tx.attendanceRecord.update({
          where: { id: att.id },
          data: {
            isReversed: true,
            reversedAt: new Date(),
            comment: att.comment
              ? `${att.comment} [已由 ${operatorName} 执行反结课冲正]`
              : `[已由 ${operatorName} 执行反结课冲正]`,
          },
        });
      }

      // 3. 排课日程状态回滚为 scheduled，语义类型恢复为 regular
      await tx.scheduleEvent.update({
        where: { id: schedule.id },
        data: {
          status: 'scheduled',
          semanticType: 'regular',
        },
      });

      return {
        success: true,
        scheduleEventId,
        reversedCount: activeAttendances.length,
        refundedLessons: refundedLessonTotal,
        message: `反结课冲正成功！已回滚 ${activeAttendances.length} 条点名记录，原路退还 ${refundedLessonTotal} 课时`,
      };
    });
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
}
