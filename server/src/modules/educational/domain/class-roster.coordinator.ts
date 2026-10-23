import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AssignStudentsCommand,
  AssignStudentsResult,
  RemoveStudentCommand,
  RemoveStudentResult,
  UnassignedRosterQuery,
  UnassignedRosterResult,
  UnassignedStudentItemView,
  ClassRosterResult,
  ClassRosterStudentView,
  StudentAssignItemResult,
  ClassCapacityExceededException,
  DuplicateEnrollmentException,
  PackageNotEligibleException,
  StudentStatusBlockedException,
} from './class-roster.types';

@Injectable()
export class ClassRosterCoordinator {
  private readonly logger = new Logger(ClassRosterCoordinator.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. 批量分班入读 (assignStudents)
   * 闭环职责：班容行级 CAS 并发锁、原班人数原子冲减、课包智能匹配嗅探、学籍状态推进、幂等防重复
   */
  async assignStudents(cmd: AssignStudentsCommand): Promise<AssignStudentsResult> {
    const rawStudentIds = cmd.studentIds || [];
    const uniqueStudentIds = Array.from(new Set(rawStudentIds.filter(Boolean)));

    if (uniqueStudentIds.length === 0) {
      throw new BadRequestException('请至少选择一名待分班学员');
    }

    return this.prisma.$transaction(
      async (tx) => {
        // 1.1 查询目标班级
        const targetClass = await tx.class.findUnique({
          where: { id: cmd.classId },
          include: { course: true },
        });

        if (!targetClass) {
          throw new NotFoundException(`目标班级不存在 (ID: ${cmd.classId})`);
        }

        // 1.2 批量加载学员及其课包
        const students = await tx.student.findMany({
          where: { id: { in: uniqueStudentIds } },
          include: {
            packages: {
              where: {
                courseId: targetClass.courseId,
                status: 'active',
                remainingLessons: { gt: 0 },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        });

        if (students.length !== uniqueStudentIds.length) {
          const foundIds = new Set(students.map((s) => s.id));
          const missingIds = uniqueStudentIds.filter((id) => !foundIds.has(id));
          throw new NotFoundException(`部分学员档案未找到: ${missingIds.join(', ')}`);
        }

        // 1.3 逐个学员校验业务不变量并匹配课包
        const previousClassDeductions = new Map<string, number>();
        const studentAssignResults: StudentAssignItemResult[] = [];
        const packagesToUpdate: Array<{ packageId: string; studentId: string }> = [];

        for (const student of students) {
          // 学籍状态检查
          if (student.status === 'suspended' || student.status === 'dropped_out') {
            throw new StudentStatusBlockedException(
              `学员「${student.name}」当前处于 [${student.status}] 状态，禁止分班入读`,
            );
          }

          // 课包匹配嗅探：优先使用显示指定的 packageIds，否则自动匹配第一个有效课包
          let matchedPkg: any = null;
          if (cmd.packageIds && cmd.packageIds.length > 0) {
            matchedPkg = student.packages.find((p) => cmd.packageIds!.includes(p.id));
          }
          if (!matchedPkg) {
            matchedPkg = student.packages[0];
          }

          if (!matchedPkg) {
            throw new PackageNotEligibleException(
              `学员「${student.name}」未持有课程「${targetClass.course.name}」的有效可用课包`,
            );
          }

          // 幂等检查：是否已在目标班级中
          if (matchedPkg.classId === targetClass.id) {
            studentAssignResults.push({
              studentId: student.id,
              studentName: student.name,
              studentNo: student.studentNo,
              packageId: matchedPkg.id,
              previousClassId: targetClass.id,
              status: 'idempotent_noop',
            });
            continue;
          }

          // 跨班重编检查：若原先已有班级，登记原班人数核销
          if (matchedPkg.classId) {
            const currentDec = previousClassDeductions.get(matchedPkg.classId) || 0;
            previousClassDeductions.set(matchedPkg.classId, currentDec + 1);
            studentAssignResults.push({
              studentId: student.id,
              studentName: student.name,
              studentNo: student.studentNo,
              packageId: matchedPkg.id,
              previousClassId: matchedPkg.classId,
              status: 'transferred',
            });
          } else {
            studentAssignResults.push({
              studentId: student.id,
              studentName: student.name,
              studentNo: student.studentNo,
              packageId: matchedPkg.id,
              previousClassId: null,
              status: 'assigned',
            });
          }

          packagesToUpdate.push({
            packageId: matchedPkg.id,
            studentId: student.id,
          });
        }

        // 1.4 计算有效需要新增的人数 (排除幂等无害跳过项)
        const effectiveIncoming = packagesToUpdate.length;

        // 若全部为幂等无害项，直接返回
        if (effectiveIncoming === 0) {
          return {
            success: true,
            classId: targetClass.id,
            className: targetClass.name,
            assignedCount: 0,
            currentStudentCount: targetClass.currentStudentCount,
            capacity: targetClass.capacity,
            remainingCapacity: Math.max(0, targetClass.capacity - targetClass.currentStudentCount),
            isFull: targetClass.currentStudentCount >= targetClass.capacity,
            dryRun: !!cmd.dryRun,
            students: studentAssignResults,
            message: '所选学员均已在当前班级中，操作幂等完成',
          };
        }

        // 1.5 班容硬顶前置校验
        if (targetClass.currentStudentCount + effectiveIncoming > targetClass.capacity) {
          throw new ClassCapacityExceededException(
            `班级「${targetClass.name}」可用容量不足（额定容量 ${targetClass.capacity} 人，当前已在读 ${targetClass.currentStudentCount} 人，拟编入 ${effectiveIncoming} 人）`,
          );
        }

        // 若为只读仿真预演 (dryRun)，直接返回推演结果，不执行写操作
        if (cmd.dryRun) {
          const simulatedCount = targetClass.currentStudentCount + effectiveIncoming;
          return {
            success: true,
            classId: targetClass.id,
            className: targetClass.name,
            assignedCount: effectiveIncoming,
            currentStudentCount: simulatedCount,
            capacity: targetClass.capacity,
            remainingCapacity: Math.max(0, targetClass.capacity - simulatedCount),
            isFull: simulatedCount >= targetClass.capacity,
            dryRun: true,
            students: studentAssignResults,
            message: `仿真预检通过：拟为班级编入 ${effectiveIncoming} 名学员`,
          };
        }

        // 1.6 行级 CAS 条件并发锁 (Row-Level Optimistic Lock Guard)
        // 确保原子自增的同时，严格守卫 currentStudentCount + effectiveIncoming <= capacity
        const casResult = await tx.class.updateMany({
          where: {
            id: targetClass.id,
            currentStudentCount: { lte: targetClass.capacity - effectiveIncoming },
          },
          data: {
            currentStudentCount: { increment: effectiveIncoming },
          },
        });

        if (casResult.count === 0) {
          throw new ClassCapacityExceededException(
            `班级「${targetClass.name}」在并发抢占中已达容量上限，名额不足，入班事务已安全回滚`,
          );
        }

        // 1.7 原班级人数原子核销
        for (const [oldClassId, decCount] of previousClassDeductions.entries()) {
          await tx.class.update({
            where: { id: oldClassId },
            data: {
              currentStudentCount: { decrement: decCount },
            },
          });
          this.logger.log(`原班级 (ID: ${oldClassId}) 已原子核销 ${decCount} 名学员在读名额`);
        }

        // 1.8 批量绑定课包并推进学员学籍状态
        for (const item of packagesToUpdate) {
          await tx.studentCoursePackage.update({
            where: { id: item.packageId },
            data: { classId: targetClass.id },
          });

          // 推进学员主体学籍状态为 in_class
          await tx.student.update({
            where: { id: item.studentId },
            data: { status: 'in_class' },
          });
        }

        // 1.9 读取持久化后最新的班级状态
        const refreshedTargetClass = await tx.class.findUnique({
          where: { id: targetClass.id },
        });

        const finalCount = refreshedTargetClass!.currentStudentCount;

        return {
          success: true,
          classId: targetClass.id,
          className: targetClass.name,
          assignedCount: effectiveIncoming,
          currentStudentCount: finalCount,
          capacity: targetClass.capacity,
          remainingCapacity: Math.max(0, targetClass.capacity - finalCount),
          isFull: finalCount >= targetClass.capacity,
          dryRun: false,
          students: studentAssignResults,
          message: `成功为班级「${targetClass.name}」编入 ${effectiveIncoming} 名学员，当前在读 ${finalCount}/${targetClass.capacity} 人`,
        };
      },
      {
        timeout: 10000,
      },
    );
  }

  /**
   * 2. 合规移出班级并回退待分班池 (removeStudent)
   * 闭环职责：课包解绑 classId=null、班级人数原子-1、学员状态自愈检测、异动审计归档
   */
  async removeStudent(cmd: RemoveStudentCommand): Promise<RemoveStudentResult> {
    return this.prisma.$transaction(async (tx) => {
      // 2.1 检查班级
      const targetClass = await tx.class.findUnique({
        where: { id: cmd.classId },
      });
      if (!targetClass) {
        throw new NotFoundException(`班级不存在 (ID: ${cmd.classId})`);
      }

      // 2.2 检查学员及在读课包
      const student = await tx.student.findUnique({
        where: { id: cmd.studentId },
        include: {
          packages: {
            where: { classId: cmd.classId, status: 'active' },
          },
        },
      });

      if (!student) {
        throw new NotFoundException(`学员不存在 (ID: ${cmd.studentId})`);
      }

      const pkg = student.packages[0];
      if (!pkg) {
        throw new BadRequestException(
          `学员「${student.name}」在班级「${targetClass.name}」中无有效在读课包`,
        );
      }

      // 2.3 课包解绑班级 (恢复为 classId = null)
      await tx.studentCoursePackage.update({
        where: { id: pkg.id },
        data: { classId: null },
      });

      // 2.4 班级在读人数原子递减 (保底为 0)
      const updatedClass = await tx.class.update({
        where: { id: targetClass.id },
        data: {
          currentStudentCount: {
            decrement: targetClass.currentStudentCount > 0 ? 1 : 0,
          },
        },
      });

      // 2.5 学员学籍状态机自愈：检查该学员是否还挂载在其他有效班级
      const otherClassCount = await tx.studentCoursePackage.count({
        where: {
          studentId: student.id,
          id: { not: pkg.id },
          status: 'active',
          classId: { not: null },
        },
      });

      let updatedStudentStatus: 'normal' | 'in_class' = student.status as any;
      if (otherClassCount === 0 && student.status === 'in_class') {
        updatedStudentStatus = 'normal';
        await tx.student.update({
          where: { id: student.id },
          data: { status: 'normal' },
        });
        this.logger.log(`学员「${student.name}」已无其它在读班级，学籍状态自愈回退至 normal`);
      }

      // 2.6 记录异动审计
      await tx.studentAbnormalMovement.create({
        data: {
          studentId: student.id,
          type: 'transfer_class',
          reasonCategory: 'REMOVE_TO_UNASSIGNED',
          reasonDetail: cmd.reason || '移出班级并回退待分班池',
          status: 'approved',
          originalData: JSON.stringify({ classId: targetClass.id, className: targetClass.name }),
          targetData: JSON.stringify({ classId: null, fallbackPool: 'unassigned' }),
        },
      });

      return {
        success: true,
        classId: targetClass.id,
        className: targetClass.name,
        studentId: student.id,
        studentName: student.name,
        packageId: pkg.id,
        unassignedLessons: pkg.remainingLessons,
        newClassStudentCount: updatedClass.currentStudentCount,
        studentStatus: updatedStudentStatus,
        fallbackToUnassignedPool: true,
        message: `学员「${student.name}」已成功移出班级「${targetClass.name}」，名额已释放，课包已回退至待分班池`,
      };
    });
  }

  /**
   * 3. 待分班看板名册聚合查询 (getUnassignedRoster)
   * 闭环职责：服务端高效分页查询、过滤、汇总度量卡片指标
   */
  async getUnassignedRoster(query?: UnassignedRosterQuery): Promise<UnassignedRosterResult> {
    const page = Math.max(1, Number(query?.page) || 1);
    const pageSize = Math.max(1, Number(query?.pageSize) || 20);
    const skip = (page - 1) * pageSize;

    // 构建查询条件：课包未分班 (classId 为 null)，且 status 为 active，剩余课时 > 0
    const where: Prisma.StudentCoursePackageWhereInput = {
      classId: null,
      status: 'active',
      remainingLessons: { gt: 0 },
    };

    if (query?.courseId) {
      where.courseId = query.courseId;
    }

    const studentWhere: Prisma.StudentWhereInput = {};
    if (query?.campusId && query.campusId !== 'all') {
      studentWhere.campusId = query.campusId;
    }
    if (query?.keyword) {
      studentWhere.OR = [
        { name: { contains: query.keyword } },
        { studentNo: { contains: query.keyword } },
        { phone: { contains: query.keyword } },
      ];
    }
    if (Object.keys(studentWhere).length > 0) {
      where.student = studentWhere;
    }

    // 并行拉取总记录数、分页课包明细以及全局未分配课时总数
    const [total, packages, totalLessonsAgg, allMatched] = await Promise.all([
      this.prisma.studentCoursePackage.count({ where }),
      this.prisma.studentCoursePackage.findMany({
        where,
        include: {
          student: {
            include: { campus: true },
          },
          course: true,
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studentCoursePackage.aggregate({
        where,
        _sum: { remainingLessons: true },
      }),
      // 汇总卡片按全量口径统计（而非当前分页），且「待分班人数」按学员去重
      this.prisma.studentCoursePackage.findMany({
        where,
        select: { studentId: true, createdAt: true },
      }),
    ]);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthlyNewCount = 0;
    let totalWaitDays = 0;

    const list: UnassignedStudentItemView[] = packages.map((pkg) => {
      const waitDays = Math.max(
        0,
        Math.floor((now.getTime() - pkg.createdAt.getTime()) / (1000 * 3600 * 24)),
      );

      return {
        id: `unas-${pkg.studentId}-${pkg.id}`,
        studentId: pkg.studentId,
        name: pkg.student.name,
        studentNo: pkg.student.studentNo,
        avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=60',
        gender: pkg.student.gender || 'male',
        phone: pkg.student.phone || '',
        campusId: pkg.student.campusId,
        campusName: pkg.student.campus?.name || '校区',
        courseId: pkg.courseId,
        courseName: pkg.course.name,
        packageId: pkg.id,
        unassignedLessons: pkg.remainingLessons,
        preferredTime: '周六上午 09:00-10:30',
        signupDate: pkg.createdAt.toISOString().slice(0, 10),
        waitDays,
        counselor: '学管老师',
        assessmentScore: 90,
        assessmentSummary: '建议根据水平编入相应班级',
      };
    });

    const monthlyNewStudents = new Set<string>();
    for (const m of allMatched) {
      totalWaitDays += Math.max(
        0,
        Math.floor((now.getTime() - m.createdAt.getTime()) / (1000 * 3600 * 24)),
      );
      if (m.createdAt.getMonth() === currentMonth && m.createdAt.getFullYear() === currentYear) {
        monthlyNewStudents.add(m.studentId);
      }
    }
    monthlyNewCount = monthlyNewStudents.size;
    const distinctStudentCount = new Set(allMatched.map((m) => m.studentId)).size;

    const totalUnassignedLessons = totalLessonsAgg._sum.remainingLessons || 0;
    const avgWaitDays = allMatched.length > 0 ? Number((totalWaitDays / allMatched.length).toFixed(1)) : 0;

    return {
      total,
      page,
      pageSize,
      summary: {
        totalStudents: distinctStudentCount,
        totalUnassignedLessons,
        monthlyNewCount,
        avgWaitDays,
      },
      list,
    };
  }

  /**
   * 4. 班级花名册全景查询 (getClassRoster)
   * 闭环职责：在读学员画像集合、实时满班率计算、<=3课时预警标红
   */
  async getClassRoster(classId: string): Promise<ClassRosterResult> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        course: true,
        teacher: true,
        classroom: true,
        studentPackages: {
          where: { status: 'active' },
          include: { student: true },
        },
      },
    });

    if (!cls) {
      throw new NotFoundException(`未找到班级 ID: ${classId}`);
    }

    const students: ClassRosterStudentView[] = cls.studentPackages.map((pkg) => ({
      studentId: pkg.student.id,
      packageId: pkg.id,
      name: pkg.student.name,
      studentNo: pkg.student.studentNo,
      phone: pkg.student.phone,
      avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=60',
      remainingLessons: pkg.remainingLessons,
      consumedLessons: pkg.consumedLessons,
      bonusLessons: pkg.bonusLessons,
      isLessonDeficit: pkg.remainingLessons <= 3,
      joinDate: pkg.updatedAt.toISOString().slice(0, 10),
      status: pkg.student.status,
    }));

    const occupancyRate =
      cls.capacity > 0
        ? Math.min(100, Math.round((cls.currentStudentCount / cls.capacity) * 100))
        : 100;

    return {
      classId: cls.id,
      className: cls.name,
      classCode: cls.code,
      courseId: cls.courseId,
      courseName: cls.course.name,
      teacherName: cls.teacher.realName,
      classroomName: cls.classroom.name,
      capacity: cls.capacity,
      currentStudentCount: cls.currentStudentCount,
      occupancyRate,
      isFull: cls.currentStudentCount >= cls.capacity,
      availableCapacity: Math.max(0, cls.capacity - cls.currentStudentCount),
      students,
    };
  }
}
