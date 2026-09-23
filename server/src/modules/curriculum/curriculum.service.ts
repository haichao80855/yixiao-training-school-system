import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCourseDto,
  UpdateCourseDto,
  UpdateCourseStatusDto,
  AuthorizeCampusesDto,
  CreateCourseUnitDto,
} from './dto/course.dto';

@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 分页与多维筛选课程列表
   */
  async getCourses(query: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    subject?: string;
    grade?: string;
    attribute?: string;
    status?: string;
    campusId?: string;
  }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword } },
        { code: { contains: query.keyword } },
      ];
    }

    if (query.subject) {
      where.subject = query.subject;
    }

    if (query.grade) {
      where.grade = query.grade;
    }

    if (query.attribute) {
      where.attribute = query.attribute;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.campusId) {
      // 检查是否有该校区的授权
      where.campusAuths = {
        some: {
          campusId: query.campusId,
        },
      };
    }

    const [total, list] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          campusAuths: {
            include: {
              campus: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          _count: {
            select: {
              units: true,
              classes: true,
              studentPackages: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      list: list.map((item) => ({
        ...item,
        authorizedCampuses: item.campusAuths.map((auth) => auth.campus),
        unitCount: item._count.units,
        activeClassCount: item._count.classes,
        enrolledStudentCount: item._count.studentPackages,
      })),
    };
  }

  /**
   * 课程详情（含大纲与校区授权）
   */
  async getCourseById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        campusAuths: {
          include: {
            campus: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        units: {
          orderBy: { sort: 'asc' },
          include: {
            lessons: {
              orderBy: { sort: 'asc' },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`未找到 ID 为 ${id} 的课程信息`);
    }

    return {
      ...course,
      authorizedCampuses: course.campusAuths.map((ca) => ca.campus),
    };
  }

  /**
   * 新增课程
   */
  async createCourse(dto: CreateCourseDto) {
    const existing = await this.prisma.course.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`课程代码 ${dto.code} 已存在，请勿重复创建`);
    }

    const course = await this.prisma.course.create({
      data: {
        code: dto.code,
        name: dto.name,
        cover: dto.cover,
        pricePerLesson: dto.pricePerLesson,
        totalLessons: dto.totalLessons,
        subject: dto.subject,
        grade: dto.grade,
        attribute: dto.attribute,
        description: dto.description,
        status: 'enabled',
      },
    });

    // 若指定了校区授权，则建立关联
    if (dto.campusIds && dto.campusIds.length > 0) {
      await this.prisma.courseCampusAuth.createMany({
        data: dto.campusIds.map((campusId) => ({
          courseId: course.id,
          campusId,
        })),
      });
    }

    return this.getCourseById(course.id);
  }

  /**
   * 更新课程基本信息
   */
  async updateCourse(id: string, dto: UpdateCourseDto) {
    await this.getCourseById(id);

    return this.prisma.course.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 切换课程启用/停用状态
   */
  async updateCourseStatus(id: string, dto: UpdateCourseStatusDto) {
    await this.getCourseById(id);

    return this.prisma.course.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  /**
   * 跨校区授权
   */
  async authorizeCampuses(id: string, dto: AuthorizeCampusesDto) {
    await this.getCourseById(id);

    // 先删除原授权，重新建立新授权列表
    return this.prisma.$transaction(async (tx) => {
      await tx.courseCampusAuth.deleteMany({
        where: { courseId: id },
      });

      if (dto.campusIds && dto.campusIds.length > 0) {
        await tx.courseCampusAuth.createMany({
          data: dto.campusIds.map((cid) => ({
            courseId: id,
            campusId: cid,
          })),
        });
      }

      return tx.courseCampusAuth.findMany({
        where: { courseId: id },
        include: { campus: true },
      });
    });
  }

  /**
   * 查询单元大纲
   */
  async getCourseUnits(courseId: string) {
    await this.getCourseById(courseId);

    return this.prisma.courseUnit.findMany({
      where: { courseId },
      orderBy: { sort: 'asc' },
      include: {
        lessons: {
          orderBy: { sort: 'asc' },
        },
      },
    });
  }

  /**
   * 新增课程单元及课次
   */
  async createUnit(courseId: string, dto: CreateCourseUnitDto) {
    await this.getCourseById(courseId);

    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.courseUnit.create({
        data: {
          courseId,
          unitName: dto.unitName,
          sort: dto.sort || 0,
        },
      });

      if (dto.lessons && dto.lessons.length > 0) {
        await tx.courseLesson.createMany({
          data: dto.lessons.map((lesson, idx) => ({
            unitId: unit.id,
            lessonName: lesson.lessonName,
            durationMin: lesson.durationMin || 90,
            courseware: lesson.courseware || null,
            sort: lesson.sort !== undefined ? lesson.sort : idx + 1,
          })),
        });
      }

      return tx.courseUnit.findUnique({
        where: { id: unit.id },
        include: { lessons: { orderBy: { sort: 'asc' } } },
      });
    });
  }

  /**
   * 删除单元
   */
  async deleteUnit(unitId: string) {
    const unit = await this.prisma.courseUnit.findUnique({
      where: { id: unitId },
    });
    if (!unit) {
      throw new NotFoundException(`未找到单元 ID: ${unitId}`);
    }

    await this.prisma.courseLesson.deleteMany({ where: { unitId } });
    await this.prisma.courseUnit.delete({ where: { id: unitId } });

    return { success: true, message: '单元及其下属课次已安全删除' };
  }

  /**
   * 删除单一课次
   */
  async deleteLesson(lessonId: string) {
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) {
      throw new NotFoundException(`未找到课次 ID: ${lessonId}`);
    }

    await this.prisma.courseLesson.delete({ where: { id: lessonId } });
    return { success: true, message: '课次已删除' };
  }
}
