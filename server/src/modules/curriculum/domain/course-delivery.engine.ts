import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AuthorizeDeliveryCommand,
  DeliveryAuthorizationReceipt,
  CourseDeliveryAccessResult,
  CampusDeliveryCatalogSnapshot,
  CampusDeliveryCatalogItem,
} from './course-delivery.types';

@Injectable()
export class CourseDeliveryEngine {
  private readonly logger = new Logger(CourseDeliveryEngine.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. 跨校区课程交付准入前置强核验 (Delivery Access Invariant)
   * 杜绝未授权课程在物理校区违规建班、排课或履约
   */
  async assertDeliveryAccess(
    courseId: string,
    campusId: string,
  ): Promise<CourseDeliveryAccessResult> {
    // 1.1 核验课程档案与启用状态
    const course = await this.prisma.course.findFirst({
      where: {
        OR: [{ id: courseId }, { code: courseId }],
      },
    });

    if (!course) {
      throw new NotFoundException(`未找到指定课程 (ID/编码: ${courseId})`);
    }

    if (course.status !== 'enabled') {
      throw new BadRequestException(
        `课程「${course.name}」当前处于停用状态，严禁开班或交付`,
      );
    }

    // 1.2 核验实体校区
    const campus = await this.prisma.campus.findUnique({
      where: { id: campusId },
    });

    if (!campus) {
      throw new NotFoundException(`未找到指定校区 ID: ${campusId}`);
    }

    // 1.3 核验多校区物理交付授权绑定
    const authRecord = await this.prisma.courseCampusAuth.findUnique({
      where: {
        courseId_campusId: {
          courseId: course.id,
          campusId: campus.id,
        },
      },
    });

    if (!authRecord) {
      this.logger.warn(
        `跨校区未授权拦截: 课程 [${course.name}] 未对校区 [${campus.name}] 开放交付授权`,
      );
      throw new BadRequestException(
        `课程「${course.name}」未对校区「${campus.name}」开放交付授权，严禁违规开班或排课`,
      );
    }

    return {
      isDeliverable: true,
      courseId: course.id,
      courseName: course.name,
      campusId: campus.id,
      campusName: campus.name,
      status: course.status as 'enabled' | 'disabled',
    };
  }

  /**
   * 2. 批量原子同步跨校区交付授权矩阵
   */
  async authorizeDelivery(
    cmd: AuthorizeDeliveryCommand,
  ): Promise<DeliveryAuthorizationReceipt> {
    const course = await this.prisma.course.findUnique({
      where: { id: cmd.courseId },
    });

    if (!course) {
      throw new NotFoundException(`未找到对应课程 ID: ${cmd.courseId}`);
    }

    // 过滤去重
    const targetCampusIds = Array.from(new Set(cmd.campusIds || []));

    // 核验校区真实性
    if (targetCampusIds.length > 0) {
      const existingCampuses = await this.prisma.campus.findMany({
        where: { id: { in: targetCampusIds } },
        select: { id: true },
      });
      if (existingCampuses.length !== targetCampusIds.length) {
        throw new BadRequestException('授权列表中包含不存在的非法校区 ID');
      }
    }

    // 原子同步关系表
    await this.prisma.$transaction(async (tx) => {
      await tx.courseCampusAuth.deleteMany({
        where: { courseId: course.id },
      });

      if (targetCampusIds.length > 0) {
        await tx.courseCampusAuth.createMany({
          data: targetCampusIds.map((cid) => ({
            courseId: course.id,
            campusId: cid,
          })),
        });
      }
    });

    this.logger.log(
      `课程 [${course.name}] 跨校区交付授权同步完成，覆盖 ${targetCampusIds.length} 所物理校区`,
    );

    return {
      courseId: course.id,
      courseName: course.name,
      authorizedCampusIds: targetCampusIds,
      totalAuthorized: targetCampusIds.length,
    };
  }

  /**
   * 3. 获取指定校区权威可交付课程大盘快照 (Deliverable Catalog Snapshot)
   */
  async getDeliverableCatalog(
    campusId: string,
  ): Promise<CampusDeliveryCatalogSnapshot> {
    const campus = await this.prisma.campus.findUnique({
      where: { id: campusId },
    });
    if (!campus) {
      throw new NotFoundException(`未找到指定校区 ID: ${campusId}`);
    }

    const authorizedCourses = await this.prisma.course.findMany({
      where: {
        status: 'enabled',
        campusAuths: {
          some: { campusId },
        },
      },
      include: {
        _count: {
          select: {
            classes: { where: { campusId } },
            studentPackages: {
              where: {
                student: { campusId },
                status: 'active',
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const catalog: CampusDeliveryCatalogItem[] = authorizedCourses.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      subject: c.subject,
      grade: c.grade,
      pricePerLesson: c.pricePerLesson,
      totalLessons: c.totalLessons,
      status: c.status,
      activeClassCount: c._count.classes,
      enrolledStudentCount: c._count.studentPackages,
    }));

    return {
      campusId: campus.id,
      campusName: campus.name,
      totalCourses: catalog.length,
      catalog,
    };
  }

  /**
   * 4. 学员跨校区转校资质核验
   * 校验学员名下所有有效课包在目标校区是否全部具备交付授权
   */
  async assertTransferEligibility(
    studentId: string,
    targetCampusId: string,
  ): Promise<void> {
    const targetCampus = await this.prisma.campus.findUnique({
      where: { id: targetCampusId },
    });
    if (!targetCampus) {
      throw new NotFoundException(`目标校区 ${targetCampusId} 不存在`);
    }

    const activePackages = await this.prisma.studentCoursePackage.findMany({
      where: {
        studentId,
        status: 'active',
      },
      include: {
        course: { select: { id: true, name: true } },
      },
    });

    if (activePackages.length === 0) {
      return;
    }

    const courseIds = Array.from(new Set(activePackages.map((p) => p.courseId)));
    const authorized = await this.prisma.courseCampusAuth.findMany({
      where: {
        campusId: targetCampusId,
        courseId: { in: courseIds },
      },
      select: { courseId: true },
    });

    const authorizedCourseSet = new Set(authorized.map((a) => a.courseId));
    const missingCourses = activePackages
      .filter((p) => !authorizedCourseSet.has(p.courseId))
      .map((p) => p.course.name);

    if (missingCourses.length > 0) {
      throw new BadRequestException(
        `目标校区「${targetCampus.name}」未获课程 [${Array.from(new Set(missingCourses)).join('、')}] 的交付授权，无法办理转校`,
      );
    }
  }
}
