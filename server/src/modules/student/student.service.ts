import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { EnrollStudentDto } from './dto/enroll.dto';
import { CreateMovementDto } from './dto/movement.dto';
import { RechargeWalletDto, WithdrawWalletDto } from './dto/wallet.dto';
import {
  CreateServiceFeeDto,
  VerifyServiceFeeDto,
  BatchVerifyServiceFeeDto,
  ServiceFeeFilterDto,
} from './dto/service-fee.dto';

import { StudentEnrollmentCoordinator } from './domain/student-enrollment.coordinator';
import { StudentMovementCoordinator } from './domain/student-movement.coordinator';
import { CourseDeliveryEngine } from '../curriculum/domain/course-delivery.engine';
import { LearningGrowthProjector } from '../educational/domain/learning-growth.projector';
import { StudentMovementIntentDto } from './dto/student-movement.dto';
import { RENEWAL_RISK_CONSTANTS } from './domain/lesson-renewal.types';

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentCoordinator: StudentEnrollmentCoordinator,
    private readonly deliveryEngine: CourseDeliveryEngine,
    private readonly movementCoordinator: StudentMovementCoordinator,
    private readonly growthProjector: LearningGrowthProjector,
  ) {}

  /**
   * 分页与高级筛选学员列表
   */
  async getStudents(query: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: string;
    campusId?: string;
    warningLevel?: string; // urgent: <=4, warning: <=8, normal: >8
  }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.campusId && query.campusId !== 'all') {
      where.campusId = query.campusId;
    }

    if (query.status && query.status !== 'all' && query.status !== 'undefined' && query.status !== 'null') {
      where.status = query.status;
    }

    if (query.keyword && query.keyword.trim() && query.keyword !== 'undefined' && query.keyword !== 'null') {
      where.OR = [
        { name: { contains: query.keyword.trim() } },
        { phone: { contains: query.keyword.trim() } },
        { studentNo: { contains: query.keyword.trim() } },
      ];
    }

    const [total, students] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          campus: {
            select: { id: true, name: true, code: true },
          },
          wallet: true,
          packages: {
            where: { status: 'active' },
            include: {
              course: {
                select: { id: true, name: true, code: true, pricePerLesson: true },
              },
              class: {
                select: { id: true, name: true, code: true },
              },
            },
          },
          _count: {
            select: {
              attendances: true,
              orders: true,
              abnormals: true,
            },
          },
        },
      }),
    ]);

    // 格式化输出并计算课时与预警指标
    const list = students.map((stu) => {
      const totalRemainingLessons = stu.packages.reduce(
        (sum, p) => sum + p.remainingLessons,
        0,
      );
      const totalConsumedLessons = stu.packages.reduce(
        (sum, p) => sum + p.consumedLessons,
        0,
      );
      const totalRemainingAmount = stu.packages.reduce(
        (sum, p) =>
          sum +
          p.remainingLessons * (p.pricePerLesson || p.course?.pricePerLesson || 0),
        0,
      );

      let computedWarningLevel = 'normal';
      if (stu.packages.length > 0) {
        if (totalRemainingLessons <= RENEWAL_RISK_CONSTANTS.CRITICAL_LESSONS_THRESHOLD) {
          computedWarningLevel = 'urgent';
        } else if (totalRemainingLessons <= RENEWAL_RISK_CONSTANTS.WARNING_LESSONS_THRESHOLD) {
          computedWarningLevel = 'warning';
        }
      }

      const enrolledClassesCount = stu.packages.filter(
        (p) => Boolean(p.classId || p.class) && p.remainingLessons > 0,
      ).length;
      const isAssignedClass = enrolledClassesCount > 0;

      return {
        id: stu.id,
        studentNo: stu.studentNo,
        name: stu.name,
        gender: stu.gender,
        phone: stu.phone,
        parentName: stu.parentName,
        school: stu.school,
        status: stu.status,
        campusId: stu.campusId,
        campus: stu.campus,
        principalBalance: stu.wallet?.principalBalance || 0,
        bonusBalance: stu.wallet?.bonusBalance || 0,
        goldPoints: stu.wallet?.goldPoints || 0,
        totalRemainingLessons,
        totalConsumedLessons,
        totalRemainingAmount,
        warningLevel: computedWarningLevel,
        riskLevel: computedWarningLevel === 'urgent' ? 'critical' : computedWarningLevel,
        activeCourseCount: stu.packages.length,
        enrolledClassesCount,
        isAssignedClass,
        packages: stu.packages.map((p) => ({
          packageId: p.id,
          id: p.id,
          courseId: p.courseId,
          courseName: p.course?.name || '标准课程',
          classId: p.classId,
          className: p.class?.name,
          class: p.class,
          isEnrolledClass: Boolean((p.classId || p.class) && p.remainingLessons > 0),
          totalLessons: p.totalLessons,
          remainingLessons: p.remainingLessons,
          consumedLessons: p.consumedLessons,
          pricePerLesson: p.pricePerLesson || p.course?.pricePerLesson || 0,
          course: p.course,
          status: p.status,
          expireDate: p.expiryDate ? p.expiryDate.toISOString().split('T')[0] : '2027-12-31',
        })),
        attendanceCount: stu._count.attendances,
        orderCount: stu._count.orders,
        createdAt: stu.createdAt,
      };
    });

    // 如果指定了消课预警级别过滤
    const filteredList = query.warningLevel
      ? list.filter((s) => {
          if (query.warningLevel === 'critical' || query.warningLevel === 'urgent') {
            return s.warningLevel === 'urgent' || s.riskLevel === 'critical';
          }
          return s.warningLevel === query.warningLevel || s.riskLevel === query.warningLevel;
        })
      : list;

    return {
      total: query.warningLevel ? filteredList.length : total,
      page,
      pageSize,
      list: filteredList,
    };
  }

  /**
   * 获取单一学员基础信息
   */
  async getStudentById(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        campus: true,
        wallet: true,
      },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID 为 ${id} 的档案`);
    }

    return student;
  }

  /**
   * 新建学员档案并初始化学员钱包
   */
  async createStudent(dto: CreateStudentDto) {
    // 生成以 S 开头的唯一学号序列
    const seq = Math.floor(100000 + Math.random() * 900000);
    const studentNo = `S${new Date().getFullYear().toString().slice(2)}${seq}`;

    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          studentNo,
          name: dto.name,
          gender: dto.gender,
          phone: dto.phone,
          parentName: dto.parentName,
          school: dto.school,
          birthday: dto.birthday,
          address: dto.address,
          campusId: dto.campusId,
          status: 'normal',
        },
      });

      // 初始化电子钱包
      await tx.studentWallet.create({
        data: {
          studentId: student.id,
          principalBalance: 0.0,
          bonusBalance: 0.0,
          goldPoints: 0,
        },
      });

      return tx.student.findUnique({
        where: { id: student.id },
        include: { campus: true, wallet: true },
      });
    });
  }

  /**
   * 修改学员基础档案
   */
  async updateStudent(id: string, dto: UpdateStudentDto) {
    await this.getStudentById(id);

    return this.prisma.student.update({
      where: { id },
      data: dto,
      include: { campus: true, wallet: true },
    });
  }

  /**
   * 学员 360° 全景画像
   */
  async getStudentProfile(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        campus: true,
        wallet: true,
        packages: {
          include: {
            course: true,
            class: {
              include: {
                teacher: { select: { id: true, realName: true } },
                classroom: { select: { id: true, name: true } },
              },
            },
          },
        },
        walletLedgers: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        attendances: {
          take: 30,
          orderBy: { createdAt: 'desc' },
          include: {
            scheduleEvent: {
              select: {
                id: true,
                date: true,
                startTime: true,
                endTime: true,
                semanticType: true,
                class: {
                  select: { name: true },
                },
              },
            },
          },
        },
        orders: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        abnormals: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${id}`);
    }

    // 计算课包画像与预警
    const enhancedPackages = student.packages.map((pkg) => {
      const progressPercent =
        pkg.totalLessons > 0
          ? Math.round((pkg.consumedLessons / pkg.totalLessons) * 100)
          : 0;

      let warningStatus = 'normal';
      if (pkg.remainingLessons <= 4) {
        warningStatus = 'urgent';
      } else if (pkg.remainingLessons <= 8) {
        warningStatus = 'warning';
      }

      return {
        ...pkg,
        progressPercent,
        warningStatus,
      };
    });

    // 聚合 360° 学情成长档案画像投影（含五维能力雷达与消课健康度）
    const portfolio = await this.growthProjector.projectLearningPortfolio(id);

    return {
      studentInfo: {
        id: student.id,
        studentNo: student.studentNo,
        name: student.name,
        gender: student.gender,
        phone: student.phone,
        parentName: student.parentName,
        school: student.school,
        birthday: student.birthday,
        address: student.address,
        status: student.status,
        campus: student.campus,
        createdAt: student.createdAt,
      },
      walletSummary: {
        principalBalance: student.wallet?.principalBalance || 0,
        bonusBalance: student.wallet?.bonusBalance || 0,
        goldPoints: student.wallet?.goldPoints || 0,
      },
      packages: enhancedPackages,
      walletLedgers: student.walletLedgers,
      attendances: student.attendances,
      learningRecords: portfolio.timeline,
      albumGallery: portfolio.albumGallery || [],
      portfolioShareToken: portfolio.portfolioShareToken,
      growthRadar: portfolio.growthSummary.radar,
      consumptionHealth: portfolio.consumptionHealth,
      learningPortfolio: portfolio,
      orders: student.orders,
      abnormals: student.abnormals,
    };
  }

  /**
   * 报名单开单与合同签约向导 (委托招生签约履约协调器)
   */
  async enrollStudent(dto: EnrollStudentDto, currentUser: any) {
    return this.enrollmentCoordinator.enroll(dto, currentUser);
  }

  /**
   * 7 分支学员异动状态机业务接口 (统一委托至 StudentMovementCoordinator 深模块)
   */
  async executeMovement(
    studentId: string,
    dto: CreateMovementDto | any,
    currentUser: any,
  ) {
    const intentDto = new StudentMovementIntentDto();
    Object.assign(intentDto, dto);
    const operator = {
      operatorId: currentUser?.id,
      operatorName: currentUser?.realName || currentUser?.account || '教务主管',
    };
    const receipt = await this.movementCoordinator.execute(
      studentId,
      intentDto.toIntent(),
      operator,
    );
    return {
      ...receipt,
      originalData: receipt.snapshot?.before,
      targetData: receipt.snapshot?.after,
    };
  }

  /**
   * 电子钱包充值 (本金 + 赠送金入账与流水记录)
   */
  async rechargeWallet(
    studentId: string,
    dto: RechargeWalletDto,
    currentUser?: any,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { wallet: true },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${studentId}`);
    }

    const bonusAmount = dto.bonus && dto.bonus > 0 ? dto.bonus : 0;
    const totalAmount = Number((dto.amount + bonusAmount).toFixed(2));
    const operatorName = dto.operator || currentUser?.realName || '财务主管';

    return this.prisma.$transaction(async (tx) => {
      // 1. upsert 确保钱包记录必定存在并累加余额
      const wallet = await tx.studentWallet.upsert({
        where: { studentId },
        create: {
          studentId,
          principalBalance: dto.amount,
          bonusBalance: bonusAmount,
          goldPoints: 0,
        },
        update: {
          principalBalance: { increment: dto.amount },
          bonusBalance: { increment: bonusAmount },
        },
      });

      // 2. 写入财务记账明细 (WalletLedger)
      await tx.walletLedger.create({
        data: {
          studentId,
          type: 'recharge',
          amount: totalAmount,
          principalChange: dto.amount,
          bonusChange: bonusAmount,
          description:
            dto.remark ||
            `电子钱包充值 (本金 ¥${dto.amount}${bonusAmount > 0 ? ' + 赠送 ¥' + bonusAmount : ''})`,
          operator: operatorName,
        },
      });

      return {
        success: true,
        balance: Number(
          (wallet.principalBalance + wallet.bonusBalance).toFixed(2),
        ),
        principalBalance: Number(wallet.principalBalance.toFixed(2)),
        bonusBalance: Number(wallet.bonusBalance.toFixed(2)),
        message: `充值成功！本金上账 ¥${dto.amount}${bonusAmount > 0 ? '，赠送金上账 ¥' + bonusAmount : ''}`,
      };
    });
  }

  /**
   * 电子钱包本金提现 (合规风控：严禁动用赠送金，严禁超额透支)
   */
  async withdrawWallet(
    studentId: string,
    dto: WithdrawWalletDto,
    currentUser?: any,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { wallet: true },
    });

    if (!student) {
      throw new NotFoundException(`未找到学员 ID: ${studentId}`);
    }

    const principal = student.wallet?.principalBalance || 0;
    if (dto.amount > principal) {
      throw new BadRequestException('提现金额不得超过本金余额（赠送金不可提现）');
    }

    const operatorName = dto.operator || currentUser?.realName || '财务核销';

    return this.prisma.$transaction(async (tx) => {
      // 1. 原子扣减本金余额
      const updatedWallet = await tx.studentWallet.update({
        where: { studentId },
        data: {
          principalBalance: { decrement: dto.amount },
        },
      });

      // 2. 写入出账记账明细
      await tx.walletLedger.create({
        data: {
          studentId,
          type: 'withdraw',
          amount: -dto.amount,
          principalChange: -dto.amount,
          bonusChange: 0,
          description: dto.reason
            ? `合规提现出账 ¥${dto.amount}: ${dto.reason}`
            : `合规提现出账 ¥${dto.amount}`,
          operator: operatorName,
        },
      });

      return {
        success: true,
        balance: Number(
          (updatedWallet.principalBalance + updatedWallet.bonusBalance).toFixed(
            2,
          ),
        ),
        principalBalance: Number(updatedWallet.principalBalance.toFixed(2)),
        bonusBalance: Number(updatedWallet.bonusBalance.toFixed(2)),
        message: `本金提现成功，扣减 ¥${dto.amount}`,
      };
    });
  }

  /**
   * 彻底删除学员档案及级联清理关联测试订单与资产
   */
  async deleteStudent(id: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        OR: [
          { id },
          { studentNo: id },
        ],
      },
      include: {
        orders: {
          include: {
            approval: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('学员档案不存在');
    }

    const targetId = student.id;

    await this.prisma.$transaction(async (tx) => {
      // 1. 清理关联订单的多级审批流节点与流程
      for (const order of student.orders) {
        if (order.approval) {
          await tx.approvalNode.deleteMany({
            where: { approvalFlowId: order.approval.id },
          });
          await tx.approvalFlow.delete({
            where: { id: order.approval.id },
          });
        }
      }

      // 2. 清理关联订单
      await tx.order.deleteMany({ where: { studentId: targetId } });

      // 3. 清理消课考勤记录
      await tx.attendanceRecord.deleteMany({ where: { studentId: targetId } });

      // 4. 清理签约课包
      await tx.studentCoursePackage.deleteMany({ where: { studentId: targetId } });

      // 5. 清理零钱包及账本流水
      await tx.walletLedger.deleteMany({ where: { studentId: targetId } });
      await tx.studentWallet.deleteMany({ where: { studentId: targetId } });

      // 6. 清理异动审批工单
      await tx.studentAbnormalMovement.deleteMany({ where: { studentId: targetId } });

      // 7. 最终彻底删除学员主体
      await tx.student.delete({ where: { id: targetId } });
    });

    return {
      success: true,
      message: `学员 [${student.name}] 及其关联的业务测试数据已彻底从数据库清除`,
    };
  }

  // ----------------------------------------------------------------
  // 6. 考务代报名与服务费账本 (Service Fee Ledger)
  // ----------------------------------------------------------------

  async getServiceFees(
    campusId?: string,
    query?: ServiceFeeFilterDto | string,
  ) {
    const where: Prisma.ServiceFeeRecordWhereInput = {};
    const filter: ServiceFeeFilterDto =
      typeof query === 'string' ? { status: query } : query || {};

    const effectiveCampusId = filter.campusId || campusId;
    if (effectiveCampusId && effectiveCampusId !== 'all') {
      where.campusId = effectiveCampusId;
    }
    if (filter.status && filter.status !== 'all') {
      where.status = filter.status;
    }
    if (filter.category && filter.category !== 'all') {
      where.category = filter.category;
    }
    if (filter.keyword) {
      where.OR = [
        { studentName: { contains: filter.keyword } },
        { studentNo: { contains: filter.keyword } },
        { certNo: { contains: filter.keyword } },
        { examType: { contains: filter.keyword } },
      ];
    }
    const records = await this.prisma.serviceFeeRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => ({
      ...r,
      createTime: r.createdAt.toISOString().replace('T', ' ').slice(0, 16),
      verifyTime: r.verifyTime
        ? r.verifyTime.toISOString().replace('T', ' ').slice(0, 16)
        : null,
    }));
  }

  async createServiceFee(
    dto: CreateServiceFeeDto,
    currentUser?: { realName?: string; account?: string },
  ) {
    const randomSuffix = Math.floor(10 + Math.random() * 90);
    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const record = await this.prisma.serviceFeeRecord.create({
      data: {
        certNo: dto.certNo || `BK${dateCode}-${randomSuffix}`,
        studentId: dto.studentId,
        studentName: dto.studentName,
        studentNo: dto.studentNo,
        campusId: dto.campusId || 'campus-bj-hq',
        campusName: dto.campusName || '总部校区',
        examType: dto.examType,
        category: dto.category || 'competition',
        fee: Number(dto.fee || 0),
        invoiceTitle: dto.invoiceTitle || undefined,
        yikuaibaoVoucherNo: dto.yikuaibaoVoucherNo || '',
        status: 'pending',
        operator: currentUser?.realName || currentUser?.account || '教务顾问',
        voucherImage: dto.voucherImage || undefined,
      },
    });
    return {
      ...record,
      createTime: record.createdAt.toISOString().replace('T', ' ').slice(0, 16),
      verifyTime: null,
    };
  }

  async verifyServiceFee(
    id: string,
    yikuaibaoVoucherNo?: string,
    operator?: string,
  ) {
    const record = await this.prisma.serviceFeeRecord.update({
      where: { id },
      data: {
        status: 'verified',
        verifyTime: new Date(),
        ...(yikuaibaoVoucherNo ? { yikuaibaoVoucherNo } : {}),
        ...(operator ? { operator } : {}),
      },
    });
    return {
      ...record,
      createTime: record.createdAt.toISOString().replace('T', ' ').slice(0, 16),
      verifyTime: record.verifyTime
        ? record.verifyTime.toISOString().replace('T', ' ').slice(0, 16)
        : null,
    };
  }

  async batchVerifyServiceFees(
    dto: BatchVerifyServiceFeeDto,
    currentUser?: { realName?: string; account?: string },
  ) {
    const operator =
      dto.operator || currentUser?.realName || currentUser?.account || '财务核销员';
    const now = new Date();
    const result = await this.prisma.serviceFeeRecord.updateMany({
      where: {
        id: { in: dto.ids },
        status: 'pending',
      },
      data: {
        status: 'verified',
        verifyTime: now,
        operator,
        ...(dto.yikuaibaoVoucherNo ? { yikuaibaoVoucherNo: dto.yikuaibaoVoucherNo } : {}),
      },
    });
    return {
      success: true,
      count: result.count,
      message: `成功原子核销 ${result.count} 笔考务服务费`,
    };
  }

  async deleteServiceFee(id: string) {
    return this.prisma.serviceFeeRecord.delete({
      where: { id },
    });
  }
}
